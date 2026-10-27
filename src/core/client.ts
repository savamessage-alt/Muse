// ============================================================
// REST-клиент Яндекс Музыки (TypeScript-аналог yandex-music-api)
// Все методы работают через единый транспорт и менеджер токена.
// ============================================================

import { ymFetch, YmApiError, YM_CLIENT_HEADER } from './transport'
import { tokenManager } from './tokenManager'
import { signRequest } from './sign'
import type {
  AccountStatus,
  Album,
  Artist,
  BriefInfo,
  DownloadInfo,
  Feed,
  Playlist,
  Queue,
  RadioStation,
  RadioSessionResume,
  RadioFeedback,
  SearchResult,
  Supplement,
  Track,
  TrackShort,
  User,
} from './types'

interface ApiResponse<T = unknown> {
  invocationInfo?: unknown
  error?: { name?: string; message?: string }
  result?: T
}

export type SearchType = 'all' | 'track' | 'album' | 'artist' | 'playlist' | 'podcast'

export type PlaylistOp =
  | { op: 'insert'; at: number; tracks: { id: string; albumId?: string }[] }
  | { op: 'delete'; from: number; to: number }
  | { op: 'move'; from: number; to: number }

class YandexMusicClient {
  private uid: number | null = null
  private uidPromise: Promise<number> | null = null

  /** Выполнить запрос с авторизацией и автообновлением токена при 401 */
  private async req<T>(path: string, init: Parameters<typeof ymFetch>[1] = {}): Promise<T> {
    const token = await tokenManager.getAccessToken()
    const headers: Record<string, string> = {
      Authorization: `OAuth ${token}`,
      'X-Yandex-Music-Client': YM_CLIENT_HEADER,
      ...init.headers,
    }
    try {
      const data = await ymFetch<ApiResponse<T>>(path, { ...init, headers })
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new YmApiError(data.error.message || 'API error', 0, data.error.name)
      }
      return (data?.result ?? data) as T
    } catch (e) {
      if (e instanceof YmApiError && (e.status === 401 || e.code === 'Unauthorized')) {
        // токен устарел — пробуем обновить и повторить один раз
        const token2 = await tokenManager.getAccessToken(true)
        const data2 = await ymFetch<ApiResponse<T>>(path, {
          ...init,
          headers: { ...headers, Authorization: `OAuth ${token2}` },
        })
        if (data2 && typeof data2 === 'object' && 'error' in data2 && data2.error) {
          throw new YmApiError(data2.error.message || 'API error', 0, data2.error.name)
        }
        return (data2?.result ?? data2) as T
      }
      throw e
    }
  }

  /** Получить uid аккаунта (кешируется) */
  async getUid(): Promise<number> {
    if (this.uid) return this.uid
    if (!this.uidPromise) {
      this.uidPromise = (async () => {
        const me = await this.me()
        this.uid = me?.account?.uid ?? 0
        return this.uid
      })()
    }
    return this.uidPromise
  }

  // ---------- Аккаунт ----------
  /** Сбросить кешированный uid (после выхода из аккаунта) */
  reset(): void {
    this.uid = null
    this.uidPromise = null
  }
  /** Информация об аккаунте (с фолбэком на /account/status) */
  async me(): Promise<{ account: User; permissions?: unknown }> {
    try {
      return await this.req<{ account: User; permissions?: unknown }>('/me')
    } catch {
      const status = await this.accountStatus()
      return { account: status.account ?? {} }
    }
  }
  accountStatus(): Promise<AccountStatus> {
    return this.req('/account/status')
  }

  // ---------- Треки ----------
  tracks(ids: string[]): Promise<Track[]> {
    return this.req('/tracks', { method: 'POST', body: { 'track-ids': ids, 'with-positions': true } })
  }
  trackDownloadInfo(trackKey: string): Promise<DownloadInfo> {
    return this.req(`/tracks/${encodeURIComponent(trackKey)}/download-info`)
  }
  supplement(trackId: string): Promise<Supplement> {
    return this.req(`/tracks/${encodeURIComponent(trackId)}/supplement`)
  }
  /** Текст песни (с подписью запроса, как в Android-приложении) */
  async trackLyrics(trackId: string): Promise<{ lyric: string }> {
    const numeric = String(trackId).split(':')[0]
    const sign = signRequest(numeric)
    const q = new URLSearchParams({ format: 'TEXT', timeStamp: String(sign.timestamp), sign: sign.value })
    return this.req(`/tracks/${encodeURIComponent(numeric)}/lyrics?${q.toString()}`)
  }
  tracksSimilar(trackId: string): Promise<{ similarTracks: Track[] }> {
    return this.req(`/tracks/${encodeURIComponent(trackId)}/similar`)
  }

  // ---------- Лайки ----------
  async usersLikesTracks(uid?: number): Promise<TrackShort[]> {
    const u = uid ?? (await this.getUid())
    const res = await this.req<{ library?: { tracks?: { items?: TrackShort[] } } }>(`/users/${u}/likes/tracks`)
    return res?.library?.tracks?.items ?? []
  }
  async likesAddTracks(ids: string[], uid?: number): Promise<boolean> {
    const u = uid ?? (await this.getUid())
    await this.req(`/users/${u}/likes/tracks/add-multiple`, { method: 'POST', body: { 'track-ids': ids } })
    return true
  }
  async likesRemoveTracks(ids: string[], uid?: number): Promise<boolean> {
    const u = uid ?? (await this.getUid())
    await this.req(`/users/${u}/likes/tracks/remove-multiple`, { method: 'POST', body: { 'track-ids': ids } })
    return true
  }

  // ---------- Плейлисты ----------
  async playlistsList(uid?: number): Promise<Playlist[]> {
    const u = uid ?? (await this.getUid())
    const res = await this.req<Playlist[]>(`/users/${u}/playlists/list`)
    return res ?? []
  }
  async playlist(kind: string, uid?: number): Promise<Playlist | null> {
    const u = uid ?? (await this.getUid())
    const res = await this.req<Playlist | null>(`/users/${u}/playlists/${encodeURIComponent(kind)}?withTracks=true`)
    return res ?? null
  }
  async playlistCreate(title: string, uid?: number): Promise<Playlist> {
    const u = uid ?? (await this.getUid())
    return this.req(`/users/${u}/playlists/create`, {
      method: 'POST',
      body: { title, visibility: 'public' },
    })
  }
  async playlistChange(kind: string, diff: Record<string, PlaylistOp>, uid?: number): Promise<Playlist> {
    const u = uid ?? (await this.getUid())
    return this.req(`/users/${u}/playlists/${encodeURIComponent(kind)}/change`, {
      method: 'POST',
      body: { diff },
    })
  }

  /** Вставить треки в плейлист */
  async playlistInsertTracks(
    playlist: Playlist,
    tracks: { id: string; albumId?: string }[],
    at = 0,
  ): Promise<Playlist | null> {
    const kind = playlist.kind ?? ''
    const diff: Record<string, PlaylistOp> = { op_1: { op: 'insert', at, tracks } }
    return this.playlistChange(kind, diff, playlist.owner?.uid)
  }
  /** Удалить треки из плейлиста (диапазон позиций) */
  async playlistDeleteRange(playlist: Playlist, from: number, to: number): Promise<Playlist | null> {
    const kind = playlist.kind ?? ''
    const diff: Record<string, PlaylistOp> = { op_1: { op: 'delete', from, to } }
    return this.playlistChange(kind, diff, playlist.owner?.uid)
  }

  // ---------- Поиск ----------
  search(text: string, type: SearchType = 'all', page = 0): Promise<SearchResult> {
    const params = new URLSearchParams({ text, type, page: String(page) })
    return this.req(`/search?${params.toString()}`)
  }
  searchSuggest(text: string): Promise<{ suggestions?: string[] }> {
    const params = new URLSearchParams({ part: text })
    return this.req(`/search/suggest?${params.toString()}`)
  }

  // ---------- Лента и лендинг ----------
  feed(wave?: boolean): Promise<Feed> {
    return this.req(`/feed${wave ? '?wave=1' : ''}`)
  }
  landing(): Promise<unknown> {
    return this.req('/landing3')
  }
  chart(): Promise<unknown> {
    return this.req('/landing3/chart')
  }

  // ---------- Альбомы и артисты ----------
  album(id: string): Promise<Album> {
    return this.req(`/albums/${encodeURIComponent(id)}`)
  }
  albumWithTracks(id: string): Promise<Album> {
    return this.req(`/albums/${encodeURIComponent(id)}/with-tracks`)
  }
  artistBriefInfo(id: string): Promise<BriefInfo> {
    return this.req(`/artists/${encodeURIComponent(id)}/brief-info`)
  }
  artistTracks(id: string, page = 0, pageSize = 20): Promise<{ tracks?: { items?: Track[] } }> {
    return this.req(`/artists/${encodeURIComponent(id)}/tracks?page=${page}&pageSize=${pageSize}`)
  }
  artistAlbums(id: string, page = 0, pageSize = 20): Promise<{ albums?: { items?: Album[] } }> {
    return this.req(`/artists/${encodeURIComponent(id)}/direct-albums?page=${page}&pageSize=${pageSize}`)
  }
  artistAllTracks(id: string, page = 0, pageSize = 20): Promise<{ tracks?: { items?: Track[] } }> {
    return this.req(`/artists/${encodeURIComponent(id)}/tracks/all?page=${page}&pageSize=${pageSize}`)
  }

  // ---------- Радио ----------
  radioDashboard(): Promise<{ stations?: RadioStation[] }> {
    return this.req('/rotor/stations/dashboard')
  }
  radioStationTracks(type: string, tag: string): Promise<RadioSessionResume> {
    return this.req(`/rotor/station/${type}:${tag}/tracks?shuffle=true`)
  }
  radioFeedback(
    type: string,
    tag: string,
    feedback: RadioFeedback,
    timestamp: string,
    from?: string,
  ): Promise<{ status?: string }> {
    const body: Record<string, unknown> = { type: feedback, timestamp }
    if (from) body.from = from
    return this.req(`/rotor/station/${type}:${tag}/feedback`, { method: 'POST', body })
  }

  // ---------- История ----------
  musicHistory(): Promise<unknown> {
    return this.req('/music-history')
  }

  // ---------- Очередь (для Ynison) ----------
  queueIndex(queue: Queue): Promise<Queue> {
    return this.req('/queues', { method: 'POST', body: queue })
  }
  queue(qid: string): Promise<Queue> {
    return this.req(`/queues/${encodeURIComponent(qid)}`)
  }
}

export const ymClient = new YandexMusicClient()