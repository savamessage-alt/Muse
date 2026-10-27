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
    if (!tokenManager.isAuthenticated()) {
      set({ booted: true, authenticated: false })
      return
    }
    try {
      await get().refreshUser()
      await get().refreshLikes()
      await get().refreshPlaylists()
      set({ authenticated: true })
    } catch (e) {
      set({ authenticated: false })
    } finally {
      set({ booted: true })
    }
  },

  refreshUser: async () => {
    const [me, status] = await Promise.all([ymClient.me(), ymClient.accountStatus()])
    set({ user: me.account ?? null, status })
  },

  refreshLikes: async () => {
    const shorts = await ymClient.usersLikesTracks()
    set({ likedKeys: new Set(shorts.filter((s) => s.id).map((s) => `${s.id}:${s.albumId}`)) })
  },

  refreshPlaylists: async () => {
    const playlists = await ymClient.playlistsList()
    set({ playlists: playlists ?? [] })
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