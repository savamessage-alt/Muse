// ============================================================
// Форматирование и хелперы для UI
// ============================================================

import type { ArtistBrief, Track } from './types'
import { trackKey as _trackKey, coverUrl as _coverUrl } from './types'

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

/** Составной ключ трека (реэкспорт из types.ts) */
export const trackKey = _trackKey

/** URL обложки по размеру (реэкспорт из types.ts) */
export const coverUrl = _coverUrl

/** Плейсхолдер-обложка */
export const PLACEHOLDER_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#2a2a2a"/><path d="M 60 60 L 60 140 L 140 100 Z" fill="#666"/></svg>',
)

/** Инициалы пользователя для аватара без фото (Яндекс не отдаёт аватар в API) */
export function userInitials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : ''
  return (first + second).toUpperCase()
}

/** Детерминированный градиент аватара (по логину/uid) — красивый fallback вместо чужой картинки */
export function avatarGradient(seed?: string | number | null): [string, string] {
  const s = String(seed ?? 'muse')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const grads: [string, string][] = [
    ['#ff3b3b', '#ff7a00'],
    ['#7c3aed', '#ec4899'],
    ['#2563eb', '#22d3ee'],
    ['#059669', '#a3e635'],
    ['#db2777', '#f59e0b'],
    ['#0ea5e9', '#8b5cf6'],
  ]
  return grads[h % grads.length]
}

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