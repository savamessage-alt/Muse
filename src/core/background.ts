// ============================================================
// Нативный медиа-виджет (Android): MediaSession + уведомление
// с управлением (play/pause, prev/next, лайк, обложка, seekbar).
// На вебе/десктопе — no-op (там работает браузерный Media Session).
// ============================================================

import { Capacitor, registerPlugin } from '@capacitor/core'

export interface PlaybackState {
  title: string
  artist: string
  album: string
  artworkUrl?: string
  playing: boolean
  positionMs: number
  durationMs: number
  liked: boolean
  canPrev: boolean
  canNext: boolean
}

export interface PlaybackAction {
  action: 'play' | 'pause' | 'prev' | 'next' | 'seek' | 'like' | 'stop'
  positionMs: number
}

interface BackgroundPlaybackPlugin {
  start(options: PlaybackState): Promise<{ value: boolean }>
  update(options: PlaybackState): Promise<{ value: boolean }>
  stop(): Promise<{ value: boolean }>
  addListener(
    eventName: 'playbackAction',
    listenerFunc: (data: PlaybackAction) => void,
  ): Promise<{ remove: () => void }> & { remove: () => void }
}

let plugin: BackgroundPlaybackPlugin | null = null
if (Capacitor.isNativePlatform()) {
  try {
    plugin = registerPlugin<BackgroundPlaybackPlugin>('BackgroundPlayback')
  } catch {
    plugin = null
  }
}

export const backgroundPlayback = {
  active: false,

  /** Показать медиа-виджет с состоянием */
  start(state: PlaybackState): void {
    if (!plugin) return
    this.active = true
    try {
      void plugin.start(state).catch(() => {})
    } catch {
      /* не нативно */
    }
  },

  /** Обновить состояние (смена трека/позиции/лайка) */
  update(state: PlaybackState): void {
    if (!plugin || !this.active) return
    try {
      void plugin.update(state).catch(() => {})
    } catch {
      /* не нативно */
    }
  },

  /** Убрать виджет и остановить сервис */
  stop(): void {
    if (!plugin) return
    this.active = false
    try {
      void plugin.stop().catch(() => {})
    } catch {
      /* не нативно */
    }
  },

  /** Действия из нативного виджета (кнопки/seekbar/экран блокировки) */
  onAction(cb: (a: PlaybackAction) => void): void {
    if (!plugin) return
    try {
      plugin.addListener('playbackAction', cb)
    } catch {
      /* не нативно */
    }
  },
}