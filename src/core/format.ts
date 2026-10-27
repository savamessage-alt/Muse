// ============================================================
// Форматирование и хелперы для UI
// ============================================================

import type { ArtistBrief, Track } from './types'

/** «мс» → «м:сс» / «ч:мм:сс» */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** Имена артистов через запятую */
export function artistNames(artists?: ArtistBrief[]): string {
  if (!artists?.length) return '—'
  return artists.map((a) => a.name).join(', ')
}

/** Составной ключ трека */
export function trackKey(track: Pick<Track, 'id' | 'albums' | 'albumId'>): string {
  const albumId = track.albums?.[0]?.id ?? track.albumId ?? ''
  return `${track.id}:${albumId}`
}

/** URL обложки по размеру (поддерживает относительные и абсолютные URI) */
export function coverUrl(uri: string | undefined | null, size = '200x200'): string | undefined {
  if (!uri) return undefined
  let u = uri.trim()
  if (u.startsWith('//')) u = 'https:' + u
  else if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  return u.replace(/%%/g, size)
}

/** Плейсхолдер-обложка */
export const PLACEHOLDER_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#2a2a2a"/><text x="100" y="110" font-size="40" text-anchor="middle" fill="#666" font-family="Arial">♪</text></svg>',
)

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function plural(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return one
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few
  return many
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' млн'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + ' тыс.'
  return String(n)
}