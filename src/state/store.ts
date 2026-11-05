// ============================================================
// Глобальное состояние UI: пользователь, лайки, плейлисты, тосты
// ============================================================

import { create } from 'zustand'
import { ymClient } from '../core/client'
import { tokenManager } from '../core/tokenManager'
import { player } from '../core/player'
import { trackKey } from '../core/format'
import type { AccountStatus, Playlist, Track, User } from '../core/types'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error' | 'success'
}

interface AppState {
  booted: boolean
  authenticated: boolean
  user: User | null
  status: AccountStatus | null
  playlists: Playlist[]
  likedKeys: Set<string>
  toasts: Toast[]
  busy: boolean

  boot: () => Promise<void>
  /** Принудительно открыть плеер, не дожидаясь загрузки данных */
  forceBoot: () => void
  refreshUser: () => Promise<void>
  refreshLikes: () => Promise<void>
  refreshPlaylists: () => Promise<void>
  toggleLike: (track: Track) => Promise<void>
  isLiked: (track: Track) => boolean
  createPlaylist: (title: string) => Promise<Playlist | null>
  showToast: (text: string, kind?: Toast['kind']) => void
  dismissToast: (id: number) => void
  logout: () => void
}

let toastSeq = 1

export const useApp = create<AppState>((set, get) => ({
  booted: false,
  authenticated: false,
  user: null,
  status: null,
  playlists: [],
  likedKeys: new Set(),
  toasts: [],
  busy: false,

  boot: async () => {
    tokenManager.load()
    // Токен есть, но истёк и нечем обновить — не пускаем в плеер, нужен вход
    const stored = tokenManager.getToken()
    if (stored && stored.expiresAt > 0 && stored.expiresAt <= Date.now() && !stored.refreshToken) {
      console.warn('[Muse] Сохранённый токен истёк и не имеет refresh_token — требуется новый вход')
      tokenManager.clear()
      set({ booted: true, authenticated: false })
      return
    }
    if (!tokenManager.isAuthenticated()) {
      console.info('[Muse] Токена нет — показываем экран входа')
      set({ booted: true, authenticated: false })
      return
    }
    // Токен есть — пускаем в плеер сразу, данные грузим параллельно
    set({ authenticated: true })
    try {
      // Максимум 25 секунд на фоновую загрузку (профиль, лайки, плейлисты);
      // даже если часть запросов упадёт или зависнет — плеер уже открыт
      const results = await Promise.race([
        Promise.allSettled([get().refreshUser(), get().refreshLikes(), get().refreshPlaylists()]),
        new Promise((r) => setTimeout(r, 25000)),
      ])
      if (Array.isArray(results)) {
        const [u, l, p] = results
        if (u.status === 'rejected') {
          const msg = (u.reason as Error | undefined)?.message
          get().showToast('Профиль не загрузился: ' + (msg ?? 'сетевая ошибка'), 'error')
        }
        if (l.status === 'rejected') get().showToast('«Мне нравится» не загрузились', 'error')
        if (p.status === 'rejected') get().showToast('Плейлисты не загрузились', 'error')
      }
    } finally {
      set({ booted: true })
    }
  },

  forceBoot: () => set({ booted: true, authenticated: tokenManager.isAuthenticated() }),

  refreshUser: async () => {
    // Загружаем профиль и статус независимо: одна ошибка не валит другую
    const results = await Promise.allSettled([ymClient.me().then((m) => m.account), ymClient.accountStatus()])
    const acc = results[0].status === 'fulfilled' ? results[0].value : null
    const st = results[1].status === 'fulfilled' ? results[1].value : null
    if (!acc) {
      const reason = results[0].status === 'rejected' ? (results[0].reason as Error) : null
      const msg = reason ? `${reason.message}` : 'нет данных'
      console.error('[Muse] Не загрузился профиль:', reason)
      get().showToast('Профиль не загрузился: ' + msg.slice(0, 120), 'error')
      // отправить отладчику подробности (статус/код ошибки)
      try {
        void fetch('/__diag', {
          method: 'POST',
          body: JSON.stringify({ fact: 'profile-error', href: location.href, message: msg.slice(0, 300) }),
        }).catch(() => {})
      } catch {
        /* ignore */
      }
    }
    if (!st) {
      const reason = results[1].status === 'rejected' ? (results[1].reason as Error) : null
      console.error('[Muse] Не загрузился статус аккаунта:', reason)
      if (reason) {
        try {
          void fetch('/__diag', {
            method: 'POST',
            body: JSON.stringify({ fact: 'status-error', href: location.href, message: reason.message.slice(0, 300) }),
          }).catch(() => {})
        } catch {
          /* ignore */
        }
      }
    }
    set({ user: acc, status: st })
  },

  refreshLikes: async () => {
    const shorts = await ymClient.usersLikesTracks()
    set({ likedKeys: new Set(shorts.filter((s) => s.id).map((s) => `${s.id}:${s.albumId}`)) })
  },

  refreshPlaylists: async () => {
    const playlists = await ymClient.playlistsList()
    set({ playlists: Array.isArray(playlists) ? playlists : [] })
  },

  toggleLike: async (track: Track) => {
    const key = trackKey(track)
    const liked = get().likedKeys.has(key)
    // оптимистичное обновление
    const next = new Set(get().likedKeys)
    if (liked) next.delete(key)
    else next.add(key)
    set({ likedKeys: next })
    try {
      if (liked) await ymClient.likesRemoveTracks([key])
      else await ymClient.likesAddTracks([key])
    } catch (e) {
      // откат
      const rollback = new Set(get().likedKeys)
      if (liked) rollback.add(key)
      else rollback.delete(key)
      set({ likedKeys: rollback })
      get().showToast('Не удалось изменить лайк: ' + (e as Error).message, 'error')
    }
  },

  isLiked: (track: Track) => get().likedKeys.has(trackKey(track)),

  createPlaylist: async (title: string) => {
    try {
      const pl = await ymClient.playlistCreate(title)
      await get().refreshPlaylists()
      get().showToast('Плейлист создан')
      return pl
    } catch (e) {
      get().showToast('Ошибка создания: ' + (e as Error).message, 'error')
      return null
    }
  },

  showToast: (text, kind = 'info') => {
    const id = toastSeq++
    set({ toasts: [...get().toasts, { id, text, kind }] })
    setTimeout(() => get().dismissToast(id), 4000)
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  logout: () => {
    player.stop()
    ymClient.reset()
    tokenManager.clear()
    set({ authenticated: false, user: null, status: null, playlists: [], likedKeys: new Set() })
  },
}))