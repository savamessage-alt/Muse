// ============================================================
// Менеджер токена: хранение, автообновление, события
// Решает проблему «токен истёк и всё сломалось»:
//  - access_token живёт ограниченное время
//  - при истечении автоматически обновляемся по refresh_token
//  - если refresh не сработал — ждём ручной повторный вход (fallback)
// ============================================================

import type { OAuthTokenData } from './auth'
import { refreshOAuthToken } from './auth'
import { diag } from './diag'

const STORAGE_KEY = 'ym.oauth'

export interface StoredToken {
  accessToken: string
  refreshToken?: string
  expiresAt: number // мс
  tokenType?: string
  scope?: string
}

type Listener = (token: StoredToken | null, reason: 'set' | 'cleared' | 'refreshed') => void

/** Определяет, запущено ли приложение в Electron */
function isElectron(): boolean {
  if (typeof window !== 'undefined' && (window as any).ymElectronAPI) return true
  // В браузерном бандле `process` может быть недоступен или не содержать versions.electron
  // Проверяем через глобальный объект или import.meta.env
  if (typeof process !== 'undefined' && process.versions?.electron) return true
  try {
    // @ts-ignore - Vite может инжектить process.env
    if (import.meta.env?.VITE_ELECTRON === 'true') return true
  } catch {
    /* ignore */
  }
  return false
}

/** Определяет, запущено ли приложение в Capacitor (Android) */
function isCapacitor(): boolean {
  if (typeof window !== 'undefined' && (window as any).Capacitor) return true
  return false
}

/** Универсальное сохранение токена */
async function saveTokenToStorage(key: string, value: string): Promise<void> {
  if (isElectron()) {
    const api = (window as any).ymElectronAPI
    if (api?.safeEncrypt) {
      const result = await api.safeEncrypt(value)
      if (result.ok) {
        localStorage.setItem(key, result.data)
        return
      }
      console.warn('[tokenManager] safeEncrypt failed, fallback to localStorage:', result.error)
    }
  } else if (isCapacitor()) {
    // Android: Capacitor Preferences
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({ key, value })
      return
    } catch (e) {
      console.warn('[tokenManager] Capacitor Preferences set failed, fallback to localStorage:', e)
    }
  }
  // Web / fallback
  localStorage.setItem(key, value)
}

/** Универсальное чтение токена */
async function loadTokenFromStorage(key: string): Promise<string | null> {
  if (isElectron()) {
    const api = (window as any).ymElectronAPI
    const raw = localStorage.getItem(key)
    if (raw && api?.safeDecrypt) {
      const result = await api.safeDecrypt(raw)
      if (result.ok) return result.data
      console.warn('[tokenManager] safeDecrypt failed, fallback to plain localStorage:', result.error)
    }
    return raw
  } else if (isCapacitor()) {
    try {
      const { Preferences } = await import('@capacitor/preferences')
      const { value } = await Preferences.get({ key })
      if (value !== null) return value
    } catch (e) {
      console.warn('[tokenManager] Capacitor Preferences get failed, fallback to localStorage:', e)
    }
  }
  // Web / fallback
  return localStorage.getItem(key)
}

/** Универсальное удаление токена */
async function removeTokenFromStorage(key: string): Promise<void> {
  if (isElectron()) {
    localStorage.removeItem(key)
    return
  } else if (isCapacitor()) {
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.remove({ key })
      return
    } catch (e) {
      console.warn('[tokenManager] Capacitor Preferences remove failed, fallback to localStorage:', e)
    }
  }
  localStorage.removeItem(key)
}

class TokenManager {
  private token: StoredToken | null = null
  private refreshing: Promise<string> | null = null
  private listeners = new Set<Listener>()
  private reauthListeners = new Set<() => void>()

  /** загрузить токен из хранилища */
  async load(): Promise<void> {
    try {
      const raw = await loadTokenFromStorage(STORAGE_KEY)
      if (raw) this.token = JSON.parse(raw) as StoredToken
    } catch {
      this.token = null
    }
    diag('boot-load', this.token)
  }

  /** сохранить токен после любого способа входа */
  async save(data: OAuthTokenData): Promise<StoredToken> {
    const stored: StoredToken = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresIn ? Date.now() + data.expiresIn * 1000 : 0,
      tokenType: data.tokenType,
    }
    this.token = stored
    try {
      await saveTokenToStorage(STORAGE_KEY, JSON.stringify(stored))
      diag('save', stored)
    } catch {
      diag('save-failed', stored)
      /* нет доступа к хранилищу — работаем в памяти */
    }
    this.emit('set')
    return stored
  }

  async clear(): Promise<void> {
    this.token = null
    this.refreshing = null
    try {
      await removeTokenFromStorage(STORAGE_KEY)
      diag('cleared', null)
    } catch {
      /* ignore */
    }
    this.emit('cleared')
    this.reauthListeners.forEach((fn) => fn())
  }

  getToken(): StoredToken | null {
    return this.token
  }

  isAuthenticated(): boolean {
    return !!this.token?.accessToken
  }

  /**
   * Получить актуальный access_token.
   * Автоматически обновляет, если токен истёк или истечёт через <5 минут.
   * @param force принудительно перепроверить/обновить (после HTTP 401)
   */
  async getAccessToken(force = false): Promise<string> {
    const t = this.token
    if (!t || !t.accessToken) throw new Error('NO_TOKEN')

    const noExpiry = t.expiresAt === 0 // ручной токен без срока — считаем валидным
    const barelyValid = !noExpiry && t.expiresAt > 0 && t.expiresAt - Date.now() > 5 * 60 * 1000
    if (!force && (noExpiry || barelyValid)) return t.accessToken

    // Токен отсутствует вечно или почти истёк — пробуем обновить
    if (this.refreshing) return this.refreshing

    const doRefresh = async (): Promise<string> => {
      if (!this.token?.refreshToken) {
        this.notifyReauth()
        throw new Error('NO_REFRESH_TOKEN')
      }
      try {
        const fresh = await refreshOAuthToken(this.token.refreshToken)
        const stored = await this.save(fresh)
        this.emit('refreshed')
        return stored.accessToken
      } catch (e) {
        // refresh-токен отозван — нужен повторный вход
        if ((e as Error).message === 'REFRESH_REVOKED') {
          await this.clear()
        } else {
          this.notifyReauth()
        }
        throw e
      }
    }

    this.refreshing = doRefresh()
    try {
      return await this.refreshing
    } finally {
      this.refreshing = null
    }
  }

  /** скоро ли истекает access_token? */
  isExpiringSoon(): boolean {
    const t = this.token
    return !!t && t.expiresAt > 0 && t.expiresAt - Date.now() < 24 * 60 * 60 * 1000
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  onReauthNeeded(fn: () => void): () => void {
    this.reauthListeners.add(fn)
    return () => this.reauthListeners.delete(fn)
  }

  private notifyReauth(): void {
    this.reauthListeners.forEach((fn) => fn())
  }

  private emit(reason: 'set' | 'cleared' | 'refreshed'): void {
    this.listeners.forEach((fn) => fn(this.token, reason))
  }
}

export const tokenManager = new TokenManager()