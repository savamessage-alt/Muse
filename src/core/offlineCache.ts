// ============================================================
// Офлайн-кэш аудио: скачивание треков в Cache Storage (Cache API),
// чтобы их можно было слушать без интернета.
//
// - Кэш живёт в Cache Storage (есть в WebView Android, Electron, Web).
// - Ключ — id трека; значение — сам аудиофайл (mp3/aac).
// - Ссылки Яндекса подписанные и короткоживущие, поэтому кэшируем
//   тело ответа, а не ссылку: при офлайне играем из кэша.
// - Есть ограничение на размер кэша и автоочистка по объёму.
// ============================================================

import { resolveStreamUrl } from './stream'
import type { Track } from './types'

const CACHE_NAME = 'ym-audio-v1'
/** Максимальный суммарный размер кэша — 500 МБ */
const MAX_BYTES = 500 * 1024 * 1024

function cacheKey(id: string): string {
  return `/__audio/${id}`
}

async function cache(): Promise<Cache | null> {
  try {
    if (typeof caches === 'undefined') return null
    return await caches.open(CACHE_NAME)
  } catch {
    return null
  }
}

/** Есть ли трек в офлайн-кэше */
export async function isCached(id: string): Promise<boolean> {
  const c = await cache()
  if (!c) return false
  return (await c.match(cacheKey(id))) !== undefined
}

/** Размер кэша в байтах (сумма Content-Length всех записей) */
export async function cacheSize(): Promise<number> {
  const c = await cache()
  if (!c) return 0
  let total = 0
  const keys = await c.keys()
  for (const req of keys) {
    const res = await c.match(req)
    const len = Number(res?.headers.get('content-length') ?? 0)
    total += Number.isFinite(len) ? len : 0
  }
  return total
}

/** Удалить одну запись кэша */
export async function removeCached(id: string): Promise<void> {
  const c = await cache()
  if (c) await c.delete(cacheKey(id))
}

/** Полностью очистить кэш */
export async function clearCache(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') await caches.delete(CACHE_NAME)
  } catch {
    /* ignore */
  }
}

/** Если кэш перевалил за лимит — удаляем самые старые записи */
async function evictIfNeeded(): Promise<void> {
  const c = await cache()
  if (!c) return
  let total = await cacheSize()
  if (total <= MAX_BYTES) return
  const keys = await c.keys()
  // Cache API хранит в порядке добавления — удаляем с начала (старые)
  for (const req of keys) {
    if (total <= MAX_BYTES) break
    const res = await c.match(req)
    const len = Number(res?.headers.get('content-length') ?? 0)
    await c.delete(req)
    total -= Number.isFinite(len) ? len : 0
  }
}

/** Скачать трек в офлайн-кэш. Возвращает true при успехе. */
export async function cacheTrack(track: Track): Promise<boolean> {
  try {
    if (await isCached(track.id)) return true
    const choice = await resolveStreamUrl(track)
    if (!choice) return false
    const resp = await fetch(choice.url)
    if (!resp.ok) return false
    const blob = await resp.blob()
    const c = await cache()
    if (!c) return false
    const headers = new Headers({ 'content-type': blob.type || 'audio/mpeg' })
    headers.set('content-length', String(blob.size))
    await c.put(cacheKey(track.id), new Response(blob, { headers }))
    void evictIfNeeded()
    return true
  } catch {
    return false
  }
}

/** Получить URL для воспроизведения: из кэша, если есть, иначе null.
 *  Кэшированный blob-URL живёт до конца сессии — этого достаточно для плеера. */
export async function cachedObjectUrl(id: string): Promise<string | null> {
  const c = await cache()
  if (!c) return null
  const res = await c.match(cacheKey(id))
  if (!res) return null
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}