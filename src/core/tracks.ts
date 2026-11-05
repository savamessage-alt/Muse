// ============================================================
// Работа с треками: развёртывание коротких записей в полные
// (TrackShort → Track через POST /tracks пакетами)
// ============================================================

import { ymClient } from './client'
import type { Track, TrackShort } from './types'

/** Есть ли у записи полные данные (title/artists) */
export function isFullTrack(t: Track | TrackShort): t is Track {
  return typeof (t as Track).title === 'string' && ((t as Track).title?.length ?? 0) > 0
}

/**
 * Превратить список TrackShort в полные Track, сохраняя порядок.
 * Полные записи пропускаются без запросов.
 */
export async function expandTracks(input: (Track | TrackShort)[], chunkSize = 50): Promise<Track[]> {
  const result: (Track | null)[] = input.map(() => null)
  const shortIdx: number[] = []

  input.forEach((t, i) => {
    if (isFullTrack(t)) result[i] = t
    else shortIdx.push(i)
  })

  for (let off = 0; off < shortIdx.length; off += chunkSize) {
    const slice = shortIdx.slice(off, off + chunkSize)
    const keys = slice.map((i) => {
      const s = input[i] as TrackShort
      // трек без albumId — отправляем голый id (ключ с пустым albumId API отклоняет)
      return s.albumId ? `${s.id}:${s.albumId}` : String(s.id)
    })
    try {
      const tracks = await ymClient.tracks(keys)
      slice.forEach((i, k) => {
        result[i] = tracks[k] ?? null
      })
    } catch {
      // часть треков может не загрузиться — пропускаем
    }
  }

  return result.filter((t): t is Track => !!t)
}

/** Получить полный трек по короткой записи */
export async function expandTrack(t: Track | TrackShort): Promise<Track | null> {
  const [full] = await expandTracks([t])
  return full
}