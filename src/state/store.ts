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
  /** Добавить трек в конец плейлиста (по kind) */
  addToPlaylist: (track: Track, kind: string) => Promise<void>
  /** Убрать трек из плейлиста по индексу (kind известен из контекста) */
  removeFromPlaylist: (index: number, kind: string) => Promise<boolean>
  /** Удалить плейлист целиком */
  deletePlaylist: (kind: string) => Promise<void>
  showToast: (text: string, kind?: Toast['kind']) => void
  dismissToast: (id: number) => void
  logout: () => void
  /** Статистика прослушивания (мс) */
  listeningStats: { today: number; week: number; month: number; all: number }
  addListeningTime: (ms: number) => void
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
  listeningStats: { today: 0, week: 0, month: 0, all: 0 },

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
        if (l.status === 'rejected') get().showToast('«Избранное» не загрузилось', 'error')
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
    set({ likedKeys: new Set(shorts.filter((s) => s.id).map((s) => `${s.id}:${s.albumId ?? ''}`)) })
  },

  refreshPlaylists: async () => {
    const playlists = await ymClient.playlistsList()
    set({ playlists: Array.isArray(playlists) ? playlists : [] })
  },

  toggleLike: async (track: Track) => {
    const key = trackKey(track)
    const liked = get().likedKeys.has(key)
    // оптимистичное обновление (сохраняем исходное состояние для надёжного отката)
    const previous = new Set(get().likedKeys)
    const next = new Set(previous)
    if (liked) next.delete(key)
    else next.add(key)
    set({ likedKeys: next })
    try {
      if (liked) await ymClient.likesRemoveTracks([key])
      else await ymClient.likesAddTracks([key])
    } catch (e) {
      // откат к состоянию до оптимистичного обновления
      set({ likedKeys: previous })
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

  addToPlaylist: async (track, kind) => {
    const albumId = track.albums?.[0]?.id ?? track.albumId ?? undefined
    const item = { id: track.id, albumId }
    const loadFresh = async (): Promise<Playlist | null> => {
      const fresh = await ymClient.playlist(kind)
      return fresh
    }
    let pl = get().playlists.find((p) => String(p.kind) === String(kind)) ?? null
    if (pl && pl.revision == null) pl = await loadFresh().catch(() => pl)
    if (!pl) {
      const fetched = await loadFresh().catch(() => null)
      if (fetched) pl = fetched
    }
    if (!pl) {
      get().showToast('Плейлист не найден', 'error')
      return
    }
    const insert = async (target: Playlist, notify: string) => {
      await ymClient.playlistInsertTracks(target, [item], target.trackCount ?? 0)
      get().showToast(notify, 'success')
      void get().refreshPlaylists()
    }
    try {
      await insert(pl, 'Добавлено в «' + (pl.title ?? 'плейлист') + '»')
    } catch (e) {
      const msg = (e as Error).message
      if (/revision/i.test(msg)) {
        const fresh = await loadFresh().catch(() => null)
        if (fresh && fresh.revision != null && fresh.kind) {
          try {
            await insert(fresh, 'Добавлено в «' + (fresh.title ?? 'плейлист') + '»')
            return
          } catch (e2) {
            get().showToast('Не удалось добавить трек: ' + (e2 as Error).message, 'error')
            return
          }
        }
      }
      get().showToast('Не удалось добавить трек: ' + msg, 'error')
    }
  },

  removeFromPlaylist: async (index, kind) => {
    const loadFresh = async (): Promise<Playlist | null> => {
      try {
        return await ymClient.playlist(kind)
      } catch {
        return null
      }
    }
    const pl = await loadFresh()
    if (!pl) {
      get().showToast('Плейлист не найден', 'error')
      return false
    }
    const del = async (target: Playlist): Promise<boolean> => {
      await ymClient.playlistDeleteRange(target, index, index + 1)
      get().showToast('Трек убран из плейлиста', 'success')
      void get().refreshPlaylists()
      return true
    }
    try {
      return await del(pl)
    } catch (e) {
      const msg = (e as Error).message
      if (/revision/i.test(msg)) {
        const fresh = await loadFresh()
        if (fresh && fresh.revision != null && fresh.kind) {
          try {
            return await del(fresh)
          } catch (e2) {
            get().showToast('Не удалось убрать трек: ' + (e2 as Error).message, 'error')
            return false
          }
        }
      }
      get().showToast('Не удалось убрать трек: ' + msg, 'error')
      return false
    }
  },

  deletePlaylist: async (kind) => {
    try {
      await ymClient.playlistDelete(kind)
      get().showToast('Плейлист удалён', 'success')
      await get().refreshPlaylists()
    } catch (e) {
      get().showToast('Не удалось удалить плейлист: ' + (e as Error).message, 'error')
    }
  },

  showToast: (text, kind = 'info') => {
    const id = toastSeq++
    set({ toasts: [...get().toasts, { id, text, kind }] })
    setTimeout(() => get().dismissToast(id), 4000)
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  addListeningTime: (ms) => {
    const now = Date.now()
    const todayKey = `stats:${new Date(now).toISOString().slice(0, 10)}`
    const weekKey = `stats:week:${Math.floor(now / (7 * 24 * 3600 * 1000))}`
    const monthKey = `stats:month:${new Date(now).toISOString().slice(0, 7)}`
    const allKey = 'stats:all'

    const add = (key: string) => {
      const cur = Number(localStorage.getItem(key)) || 0
      localStorage.setItem(key, String(cur + ms))
    }
    add(todayKey)
    add(weekKey)
    add(monthKey)
    add(allKey)

    set((s) => ({
      listeningStats: {
        today: Number(localStorage.getItem(todayKey)) || 0,
        week: Number(localStorage.getItem(weekKey)) || 0,
        month: Number(localStorage.getItem(monthKey)) || 0,
        all: Number(localStorage.getItem(allKey)) || 0,
      },
    }))
  },

  logout: () => {
    player.stop()
    ymClient.reset()
    tokenManager.clear()
    set({ authenticated: false, user: null, status: null, playlists: [], likedKeys: new Set() })
  },
}))