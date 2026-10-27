// ============================================================
// Потоковое воспроизведение: выбор качества и получение ссылки
// Приоритет: MP3 320 → MP3 192 → MP3 128 → HLS → AAC → FLAC
// MP3 играет везде (браузер, Electron, Android WebView) без расшифровки.
//
// Получение ссылки (как в marshalX):
//  1. /tracks/{id}/download-info → варианты (codec, bitrate, url/directLink/downloadInfoUrl)
//  2. если нет прямой ссылки — скачиваем XML по downloadInfoUrl,
//     из него: host/path/ts/s, подпись sign = md5(SIGN_SALT + path[1:] + s),
//     ссылка: https://{host}/get-mp3/{sign}/{ts}{path}
// ============================================================

import { ymClient } from './client'
import { ymFetchXml, xmlTag } from './transport'
import { md5 } from './sign'
import type { FileDownloadInfo, Track } from './types'

export interface StreamChoice {
  url: string
  codec: string
  bitrate: number
  direct: boolean
}

const SIGN_SALT = 'XGRlBW9FXlekgbPrRHuSiA'

const PREFERRED: { codec: string; bitrate?: number; weight: number }[] = [
  { codec: 'mp3', bitrate: 320, weight: 100 },
  { codec: 'mp3', bitrate: 192, weight: 90 },
  { codec: 'mp3', bitrate: 128, weight: 80 },
  { codec: 'aac', weight: 70 },
  { codec: 'hls', weight: 60 },
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

/** Построить прямую ссылку из XML (host/path/ts/s) */
export function buildUrlFromXml(xml: string): string | null {
  const host = xmlTag(xml, 'host')
  const path = xmlTag(xml, 'path')
  const ts = xmlTag(xml, 'ts')
  const s = xmlTag(xml, 's')
  if (!host || !path || !s) return null
  const sign = md5(SIGN_SALT + path.slice(1) + s)
  return `https://${host}/get-mp3/${sign}/${ts ?? ''}${path}`
}

/** Получить играбельную ссылку варианта (url → directLink → XML-подпись) */
async function urlOf(info: FileDownloadInfo, mds: { host?: string; path?: string; s?: string; ts?: number }): Promise<string | null> {
  if (info.url) return info.url
  if (info.directLink) return info.directLink
  if (info.downloadInfoUrl) {
    try {
      const xml = await ymFetchXml(info.downloadInfoUrl)
      const built = buildUrlFromXml(xml)
      if (built) return built
    } catch {
      /* пробуем следующий вариант */
    }
  }
  // fallback: параметры в корне ответа (старый формат API)
  if (mds.host && mds.path && mds.s) {
    return `https://${mds.host}${mds.path}?s=${encodeURIComponent(mds.s)}&ts=${mds.ts ?? ''}`
  }
  return null
}

/** Получить лучшую ссылку для трека (с учётом качества) */
export async function resolveStreamUrl(track: Track): Promise<StreamChoice | null> {
  const albumId = track.albums?.[0]?.id ?? track.albumId ?? ''
  const key = `${track.id}:${albumId}`
  const diag = (msg: string) => {
    try {
      void fetch('/__diag', {
        method: 'POST',
        body: JSON.stringify({ fact: 'stream', href: location.href, msg: msg.slice(0, 200) }),
      }).catch(() => {})
    } catch {
      /* ignore */
    }
  }
  const info = await ymClient.trackDownloadInfo(key)
  const items = (info.items ?? []).filter((i) => i.codec !== 'encraw' && i.codec !== 'wav')
  diag('dl items=' + items.length + ' key=' + key + ' codecs=' + items.map((i) => `${i.codec}@${i.bitrateInKbps ?? '?'}`).join(','))

  const sorted = [...items].sort((a, b) => weightOf(b) - weightOf(a))
  const cap = getQualityCap()
  // учёт ограничения качества: MP3 не выше cap, остальные не ограничиваем
  const best =
    sorted.find((i) => i.codec !== 'mp3' || (i.bitrateInKbps ?? 320) <= cap) ??
    sorted.find((i) => i.codec === 'mp3') ??
    sorted[0]
  if (!best) return null

  const url = await urlOf(best, info)
  if (!url) {
    diag('urlOf=null codec=' + String(best.codec) + ' url=' + String(best.url ?? '') + ' durl=' + String(best.downloadInfoUrl ?? '').slice(0, 60))
  }
  return url
    ? {
        url,
        codec: String(best.codec ?? 'unknown'),
        bitrate: best.bitrateInKbps ?? 0,
        direct: !!best.url || !!best.directLink,
      }
    : null
}

/** Есть ли у трека доступная прямая ссылка (без подписки — только 30 сек) */
export function checkAvailability(track: Track): boolean {
  return track.available !== false
}