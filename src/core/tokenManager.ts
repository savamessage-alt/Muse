// ============================================================
// Менеджер токена: хранение, автообновление, события
// Решает проблему «токен истёк и всё сломалось»:
//  - access_token живёт ограниченное время
//  - при истечении автоматически обновляемся по refresh_token
//  - если refresh не сработал — ждём ручной повторный вход (fallback)
// ============================================================

import type { OAuthTokenData } from './auth'
import { refreshOAuthToken } from './auth'

const STORAGE_KEY = 'ym.oauth'

export interface StoredToken {
  accessToken: string
  refreshToken?: string
  expiresAt: number // мс
  tokenType?: string
  scope?: string
}

type Listener = (token: StoredToken | null, reason: 'set' | 'cleared' | 'refreshed') => void

class TokenManager {
  private token: StoredToken | null = null
  private refreshing: Promise<string> | null = null
  private listeners = new Set<Listener>()
  private reauthListeners = new Set<() => void>()

  /** загрузить токен из localStorage */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) this.token = JSON.parse(raw) as StoredToken
    } catch {
      this.token = null
    }
  }

  /** сохранить токен после любого способа входа */
  save(data: OAuthTokenData): StoredToken {
    const stored: StoredToken = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresIn ? Date.now() + data.expiresIn * 1000 : 0,
      tokenType: data.tokenType,
    }
    this.token = stored
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    } catch {
      /* нет доступа к localStorage — работаем в памяти */
    }
    this.emit('set')
    return stored
  }

  clear(): void {
    this.token = null
    this.refreshing = null
    try {
      localStorage.removeItem(STORAGE_KEY)
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
        const stored = this.save(fresh)
        this.emit('refreshed')
        return stored.accessToken
      } catch (e) {
        // refresh-токен отозван — нужен повторный вход
        if ((e as Error).message === 'REFRESH_REVOKED') {
          this.clear()
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