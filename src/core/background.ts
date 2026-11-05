// ============================================================
// Фоновое воспроизведение (Android): foreground-сервис + уведомление.
// На вебе/десктопе — no-op.
// ============================================================

import { Capacitor, registerPlugin } from '@capacitor/core'

interface BackgroundPlaybackPlugin {
  start(options: { title: string; artist: string }): Promise<{ value: boolean }>
  stop(): Promise<{ value: boolean }>
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
  /** Показать «играет в фоне» (обновляет уведомление при смене трека) */
  start(title: string, artist: string): void {
    if (!plugin) return
    try {
      void plugin.start({ title, artist }).catch(() => {})
    } catch {
      /* не нативно */
    }
  },
  /** Убрать уведомление и остановить сервис */
  stop(): void {
    if (!plugin) return
    try {
      void plugin.stop().catch(() => {})
    } catch {
      /* не нативно */
    }
  },
}