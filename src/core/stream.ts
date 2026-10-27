// ============================================================
// Потоковое воспроизведение: выбор качества и получение ссылки
// Приоритет: MP3 320 → MP3 192 → MP3 128 → HLS → AAC → (lossless позже)
// MP3 играет везде (браузер, Electron, Android WebView) без расшифровки.
// ============================================================

import { ymClient } from './client'
import type { FileDownloadInfo, Track } from './types'

export interface StreamChoice {
  url: string
  codec: string
  bitrate: number
  direct: boolean
}

const PREFERRED: { codec: string; bitrate?: number; weight: number }[] = [
  { codec: 'mp3', bitrate: 320, weight: 100 },
  { codec: 'mp3', bitrate: 192, weight: 90 },
  { codec: 'mp3', bitrate: 128, weight: 80 },
  { codec: 'mp3', bitrate: 64, weight: 70 },
  { codec: 'hls', weight: 60 },
  { codec: 'aac', weight: 50 },
  { codec: 'flac', weight: 40 },
]

function weightOf(info: FileDownloadInfo): number {
  for (const p of PREFERRED) {
    if (info.codec === p.codec && (p.bitrate === undefined || info.bitrateInKbps === p.bitrate)) {
      return p.weight + (info.bitrateInKbps ?? 0) / 1000
    }
  }
  return -1
}

/** Максимальный битрейт MP3 по настройке качества пользователя */
export function getQualityCap(): number {
  const q = localStorage.getItem('ym.quality') ?? 'mp3-320'
  if (q === 'mp3-192') return 192
  if (q === 'mp3-128') return 128
  return 320
}

function buildUrl(info: FileDownloadInfo): string | null {
  if (info.directLink) return info.directLink
  return info.url ?? null
}

/** Получить лучшую ссылку для трека (с учётом качества) */
export async function resolveStreamUrl(track: Track): Promise<StreamChoice | null> {
  const albumId = track.albums?.[0]?.id ?? track.albumId ?? ''
  const key = `${track.id}:${albumId}`
  const info = await ymClient.trackDownloadInfo(key)
  const items = info.items ?? []
  if (!items.length) {
    // fallback: собрать ссылку из параметров ответа
    if (info.host && info.path && info.s) {
      return {
        url: `https://${info.host}${info.path}?s=${encodeURIComponent(info.s)}&ts=${info.ts ?? ''}`,
        codec: 'mp3',
        bitrate: 128,
        direct: false,
      }
    }
    return null
  }

  const sorted = [...items].filter((i) => i.codec !== 'encraw')
  sorted.sort((a, b) => weightOf(b) - weightOf(a))
  // учитываем выбранное пользователем качество (ограничение битрейта MP3)
  const cap = getQualityCap()
  const best = sorted.find((i) => i.codec !== 'mp3' || (i.bitrateInKbps ?? 320) <= cap) ?? sorted[0]
  const url = buildUrl(best)
  if (!url) return null
  return {
    url,
    codec: best.codec ?? 'unknown',
    bitrate: best.bitrateInKbps ?? 0,
    direct: !!best.directLink,
  }
}

/** Есть ли у трека доступная прямая ссылка (без подписки — только 30 сек) */
export function checkAvailability(track: Track): boolean {
  return track.available !== false
}