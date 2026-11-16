// ============================================================
// REST-клиент Яндекс Музыки (TypeScript-аналог yandex-music-api)
// Все методы работают через единый транспорт и менеджер токена.
// ============================================================

import { ymFetch, ymFetchXml, YmApiError, YM_CLIENT_HEADER } from './transport'
import { tokenManager } from './tokenManager'
import { signRequest } from './sign'
import { diag } from './diag'
import type {
  AccountStatus,
  Album,
  Artist,
  BriefInfo,
  ChartPlaylist,
  DownloadInfo,
  Feed,
  FileDownloadInfo,
  HistoryItem,
  LandingBlock,
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
  /** Кэш текстов песен: id трека → текст ('' — текста нет) */
  private lyricsCache = new Map<string, string>()

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
      // Телеметрия ошибок запросов (403 и пр.) — видим точный ответ API
      diag('req-err: ' + path + ' | ' + (e instanceof Error ? e.message : String(e)).slice(0, 160))
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
  /** Информация об аккаунте. Внимание: эндпоинта /me в API нет —
   *  используем /account/status, который возвращает и аккаунт, и подписку */
  async me(): Promise<{ account: User; permissions?: unknown }> {
    const status = await this.accountStatus()
    return { account: status.account ?? {}, permissions: status.permissions }
  }
  accountStatus(): Promise<AccountStatus> {
    return this.req('/account/status')
  }

  // ---------- Треки ----------
  tracks(ids: string[]): Promise<Track[]> {
    // API принимает ТОЛЬКО form-urlencoded (JSON отклоняется с 400)
    const body = ids.map((id) => 'track-ids=' + encodeURIComponent(id)).join('&') + '&with-positions=true'
    return this.req('/tracks', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    })
  }
  trackDownloadInfo(trackKey: string): Promise<DownloadInfo> {
    const bare = String(trackKey).split(':')[0]
    // API возвращает в result ПРЯМО МАССИВ файлов: [{codec, ...}]
    // (req() уже развернул result). Fallback на голый id — если ключ id:album не сработал.
    const normalize = (arr: unknown[]): FileDownloadInfo[] =>
      arr.map((it) => {
        const r = it as Record<string, unknown>
        return {
          codec: r.codec as string | undefined,
          // API непоследователен: bitrate_in_kbps (snake), но downloadInfoUrl (camel) — читаем оба
          bitrateInKbps: (r.bitrate_in_kbps ?? r.bitrateInKbps) as number | undefined,
          directLink: (r.direct_link ?? r.directLink) as string | undefined,
          url: (r.url ?? r.url) as string | undefined,
          downloadInfoUrl: (r.download_info_url ?? r.downloadInfoUrl) as string | undefined,
          direct: !!(r.direct ?? r.direct),
          gain: !!(r.gain ?? r.gain),
          preview: !!(r.preview ?? r.preview),
          restriction: r.restriction,
        }
      })
    const req = (key: string) =>
      this.req<unknown>(`/tracks/${key}/download-info`).then((res) => {
        const arr = Array.isArray(res) ? (res as unknown[]) : ((res as { items?: unknown[] })?.items ?? [])
        return { items: normalize(arr) }
      })
    // Сначала с ключом id:album (формат библиотеки), при пустом ответе — с голым id
    return req(trackKey).then((d) => (d.items?.length ? d : req(bare)))
  }
  supplement(trackId: string): Promise<Supplement> {
    return this.req(`/tracks/${encodeURIComponent(trackId)}/supplement`)
  }
  /**
   * Текст песни.
   * API отдаёт не сам текст, а ссылку downloadUrl на txt-файл — её и скачиваем.
   * Проверка подписи на стороне Яндекса периодически ложно отвечает 403
   * «Invalid Sign» на корректный запрос (до половины ответов), поэтому
   * делаем несколько попыток с новой подписью и кэшируем результат.
   */
  async trackLyrics(trackId: string): Promise<{ lyric: string }> {
    const numeric = String(trackId).split(':')[0]
    const cached = this.lyricsCache.get(numeric)
    if (cached !== undefined) return { lyric: cached }

    const attempts = 5
    let lastError: unknown = null
    for (let i = 0; i < attempts; i++) {
      const sign = signRequest(numeric)
      const q = new URLSearchParams({ format: 'TEXT', timeStamp: String(sign.timestamp), sign: sign.value })
      try {
        const meta = await this.req<{ downloadUrl?: string }>(
          `/tracks/${encodeURIComponent(numeric)}/lyrics?${q.toString()}`,
        )
        const url = meta?.downloadUrl
        const text = url ? await ymFetchXml(url) : ''
        this.lyricsCache.set(numeric, text)
        return { lyric: text }
      } catch (e) {
        lastError = e
        const msg = e instanceof Error ? e.message : String(e)
        const errCode = e instanceof YmApiError ? e.code : ''
        // У трека просто нет текста — кэшируем пустоту и не ретраим
        if (/no lyrics found/i.test(msg) || errCode === 'not-found') {
          this.lyricsCache.set(numeric, '')
          return { lyric: '' }
        }
        // Повторяем только на «Invalid Sign» (флапающая проверка подписи)
        const isInvalidSign = /Invalid Sign/i.test(msg) || errCode === 'Invalid Sign'
        if (!isInvalidSign || i === attempts - 1) break
        await new Promise((r) => setTimeout(r, 200))
      }
    }
    throw lastError instanceof Error ? lastError : new YmApiError('Текст песни недоступен', 0)
  }
  tracksSimilar(trackId: string): Promise<{ similarTracks: Track[] }> {
    return this.req(`/tracks/${encodeURIComponent(trackId)}/similar`)
  }

  // ---------- Лайки ----------
  async usersLikesTracks(uid?: number): Promise<TrackShort[]> {
    const u = uid ?? (await this.getUid())
    const res = await this.req<unknown>(`/users/${u}/likes/tracks`)
    if (Array.isArray(res)) return res as TrackShort[]
    // API отдаёт library.tracks ПРЯМО МАССИВОМ (иногда {items}) — выравниваем, как в истории
    const lib = (res as { library?: { tracks?: unknown } } | null)?.library?.tracks
    if (Array.isArray(lib)) return lib as TrackShort[]
    if (lib && typeof lib === 'object' && Array.isArray((lib as { items?: unknown }).items)) {
      return (lib as { items: TrackShort[] }).items
    }
    return []
  }
  async likesAddTracks(ids: string[], uid?: number): Promise<boolean> {
    const u = uid ?? (await this.getUid())
    // API Яндекса принимает лайки ТОЛЬКО как form-urlencoded тело (JSON отклоняется)
    const body = ids.map((id) => 'track-ids=' + encodeURIComponent(id)).join('&')
    await this.req(`/users/${u}/likes/tracks/add-multiple`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    })
    return true
  }
  async likesRemoveTracks(ids: string[], uid?: number): Promise<boolean> {
    const u = uid ?? (await this.getUid())
    const body = ids.map((id) => 'track-ids=' + encodeURIComponent(id)).join('&')
    await this.req(`/users/${u}/likes/tracks/remove`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    })
    return true
  }

  // ---------- Лайки исполнителей и альбомов ----------
  /** id лайкнутых исполнителей */
  async usersLikesArtists(): Promise<Set<string>> {
    const u = await this.getUid()
    const res = await this.req<unknown>(`/users/${u}/likes/artists`)
    const likes = (res as { likes?: unknown } | null)?.likes ?? (Array.isArray(res) ? res : [])
    const out = new Set<string>()
    for (const l of Array.isArray(likes) ? likes : []) {
      const rec = l as Record<string, unknown>
      const v = rec.artistId ?? rec.artist_id ?? rec.id
      if (v !== undefined && v !== null) out.add(String(v))
    }
    return out
  }
  async artistsLikeAdd(ids: string[]): Promise<boolean> {
    const u = await this.getUid()
    const body = ids.map((id) => 'artist-ids=' + encodeURIComponent(id)).join('&')
    await this.req(`/users/${u}/likes/artists/add-multiple`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    })
    return true
  }
  async artistsLikeRemove(ids: string[]): Promise<boolean> {
    const u = await this.getUid()
    const body = ids.map((id) => 'artist-ids=' + encodeURIComponent(id)).join('&')
    await this.req(`/users/${u}/likes/artists/remove`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    })
    return true
  }
  /** id лайкнутых альбомов */
  async usersLikesAlbums(): Promise<Set<string>> {
    const u = await this.getUid()
    const res = await this.req<unknown>(`/users/${u}/likes/albums`)
    const likes = (res as { likes?: unknown } | null)?.likes ?? (Array.isArray(res) ? res : [])
    const out = new Set<string>()
    for (const l of Array.isArray(likes) ? likes : []) {
      const rec = l as Record<string, unknown>
      const v = rec.albumId ?? rec.album_id ?? rec.id
      if (v !== undefined && v !== null) out.add(String(v))
    }
    return out
  }
  async albumsLikeAdd(ids: string[]): Promise<boolean> {
    const u = await this.getUid()
    const body = ids.map((id) => 'album-ids=' + encodeURIComponent(id)).join('&')
    await this.req(`/users/${u}/likes/albums/add-multiple`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    })
    return true
  }
  async albumsLikeRemove(ids: string[]): Promise<boolean> {
    const u = await this.getUid()
    const body = ids.map((id) => 'album-ids=' + encodeURIComponent(id)).join('&')
    await this.req(`/users/${u}/likes/albums/remove`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    })
    return true
  }

  // ---------- Плейлисты ----------
  async playlistsList(uid?: number): Promise<Playlist[]> {
    const u = uid ?? (await this.getUid())
    const res = await this.req<Playlist[] | { playlists?: Playlist[] }>(`/users/${u}/playlists/list`)
    // API может вернуть как массив, так и обёртку {playlists: [...]} — выравниваем
    if (Array.isArray(res)) return res
    if (res && typeof res === 'object' && Array.isArray((res as { playlists?: unknown }).playlists)) {
      return (res as { playlists: Playlist[] }).playlists
    }
    return []
  }
  async playlist(kind: string, uid?: number): Promise<Playlist | null> {
    const u = uid ?? (await this.getUid())
    const res = await this.req<Playlist | null>(`/users/${u}/playlists/${encodeURIComponent(kind)}?withTracks=true`)
    return res ?? null
  }
  /** Треки чужого (системного) плейлиста, например «Премьера» из ленты */
  async playlistTracks(ownerUid: number, kind: string | number): Promise<Track[]> {
    const res = await this.req<{ tracks?: { id?: string | number; track?: Track | null }[] }>(
      `/users/${ownerUid}/playlists/${encodeURIComponent(String(kind))}?withTracks=true`,
    )
    return ((res?.tracks ?? []) as { track?: Track | null }[])
      .map((t) => t.track ?? null)
      .filter((t): t is Track => !!t?.id)
  }
  async playlistCreate(title: string, uid?: number): Promise<Playlist> {
    const u = uid ?? (await this.getUid())
    // form-urlencoded, как требует API (JSON → 400)
    return this.req(`/users/${u}/playlists/create`, {
      method: 'POST',
      body: 'title=' + encodeURIComponent(title) + '&visibility=public',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    })
  }
  async playlistChange(
    kind: string,
    diff: Record<string, PlaylistOp>,
    uid?: number,
    revision?: number,
  ): Promise<Playlist> {
    const u = uid ?? (await this.getUid())
    // form {kind, revision, diff: json-строка}; ревизия обязательна — без неё API
    // отвечает «Expected revision: N, actual revision: M»
    const body =
      'kind=' +
      encodeURIComponent(kind) +
      '&revision=' +
      encodeURIComponent(String(revision ?? 1)) +
      '&diff=' +
      encodeURIComponent(JSON.stringify(diff))
    return this.req(`/users/${u}/playlists/${encodeURIComponent(kind)}/change`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
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
    return this.playlistChange(kind, diff, playlist.owner?.uid, playlist.revision)
  }
  /** Удалить треки из плейлиста: диапазон позиций [from, to) — стартовый индекс
 *  включается, конечный НЕ включается (семантика Yandex API: удалить i-й трек —
 *  deleteRange(pl, i, i + 1)) */
  async playlistDeleteRange(playlist: Playlist, from: number, to: number): Promise<Playlist | null> {
    const kind = playlist.kind ?? ''
    const diff: Record<string, PlaylistOp> = { op_1: { op: 'delete', from, to } }
    return this.playlistChange(kind, diff, playlist.owner?.uid, playlist.revision)
  }
  /** Удалить плейлист целиком */
  async playlistDelete(kind: string, uid?: number): Promise<boolean> {
    const u = uid ?? (await this.getUid())
    await this.req(`/users/${u}/playlists/${encodeURIComponent(kind)}/delete`, { method: 'POST' })
    return true
  }

  // ---------- Поиск ----------
  async search(text: string, type: SearchType = 'all', page = 0): Promise<SearchResult> {
    // Параметры строго как в библиотеке (nocorrect, playlist-in-best обязательны для полного ответа)
    const params = new URLSearchParams({
      text,
      nocorrect: 'false',
      type,
      page: String(page),
      'playlist-in-best': 'true',
    })
    const res = await this.req<{
      tracks?: { total?: number; items?: unknown[]; results?: unknown[] }
      albums?: { total?: number; items?: unknown[]; results?: unknown[] }
      artists?: { total?: number; items?: unknown[]; results?: unknown[] }
      playlists?: { total?: number; items?: unknown[]; results?: unknown[] }
      best?: unknown
      misspell?: unknown
    }>(`/search?${params.toString()}`)
    // API отдаёт секции с полем `results` (не `items`) — выравниваем
    const fix = (s?: { total?: number; items?: unknown[]; results?: unknown[] }) =>
      s ? { total: s.total, items: (s.items ?? s.results ?? []) as unknown[] } : undefined
    return {
      tracks: fix(res.tracks),
      albums: fix(res.albums),
      artists: fix(res.artists),
      playlists: fix(res.playlists),
      best: res.best,
      misspell: res.misspell,
    } as unknown as SearchResult
  }
  searchSuggest(text: string): Promise<{ suggestions?: string[] }> {
    const params = new URLSearchParams({ part: text })
    return this.req(`/search/suggest?${params.toString()}`)
  }

  // ---------- Лента и лендинг ----------
  feed(wave?: boolean): Promise<Feed> {
    return this.req(`/feed${wave ? '?wave=1' : ''}`)
  }
  landing(blocks: string[]): Promise<LandingBlock[]> {
    const params = new URLSearchParams({
      blocks: blocks.join(','),
      eitherUserId: '10254713668400548221',
    })
    return this.req<{ blocks?: LandingBlock[] }>(`/landing3?${params.toString()}`).then((r) => r.blocks ?? [])
  }
  chart(): Promise<{ chart?: ChartPlaylist }> {
    return this.req('/landing3/chart')
  }

  // ---------- Альбомы и артисты ----------
  album(id: string): Promise<Album> {
    return this.req(`/albums/${encodeURIComponent(id)}`)
  }
  async albumWithTracks(id: string): Promise<Album> {
    // with-tracks отдаёт треки в result.volumes (на верхнем уровне), а не result.tracks.volumes —
    // приводим к единому виду Album.tracks.volumes
    const res = await this.req<Album & { volumes?: Track[][] }>(`/albums/${encodeURIComponent(id)}/with-tracks`)
    void diag('album: ' + id + ' volumes=' + String(res.volumes?.length) + ' tracks=' + (res.tracks ? 'yes' : 'no'))
    if (!res.tracks && Array.isArray(res.volumes)) {
      return { ...res, tracks: { volumes: res.volumes } }
    }
    return res
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
  /** Треки станции с seed-параметрами (настроение/энергия/язык/характер «Моей волны»).
   *  Каждый из массива передаётся как отдельный `&seed=…` — все комбинируются одновременно. */
  radioStationTracksSeed(type: string, tag: string, seeds?: string[]): Promise<RadioSessionResume> {
    const params = new URLSearchParams({ shuffle: 'true' })
    for (const s of seeds ?? []) {
      params.append('seed', s)
    }
    return this.req(`/rotor/station/${type}:${tag}/tracks?${params.toString()}`)
  }
  /** Сохранённые настройки станции (только чтение; запись API не даёт) */
  radioStationSettings(
    type: string,
    tag: string,
  ): Promise<{ language?: string; mood?: number; energy?: number; diversity?: string }> {
    return this.req(`/rotor/station/${type}:${tag}/settings`)
  }
  radioFeedback(
    type: string,
    tag: string,
    feedback: RadioFeedback,
    timestamp: string,
    trackId?: string,
    totalPlayedSeconds?: number,
    from?: string,
  ): Promise<{ status?: string }> {
    const body: Record<string, unknown> = { type: feedback, timestamp }
    if (trackId) body.trackId = trackId
    if (totalPlayedSeconds !== undefined) body.totalPlayedSeconds = totalPlayedSeconds
    if (from) body.from = from
    // radio-feedback принимает JSON (в отличие от лайков) — trackId обязателен
    return this.req(`/rotor/station/${type}:${tag}/feedback`, { method: 'POST', body })
  }

  // ---------- История ----------
  async musicHistory(): Promise<HistoryItem[]> {
    // Параметр fullModelsCount обязателен (иначе API: "Parameter value is not set")
    const res = await this.req<{ history?: unknown; historyTabs?: unknown }>('/music-history?fullModelsCount=20')
    // Новый формат ответа: result.historyTabs = [{date, items: [{context, tracks: [{type,data:{itemId:{trackId,albumId}}}]}]}]
    const tabs = res?.historyTabs
    if (Array.isArray(tabs)) {
      const out: HistoryItem[] = []
      for (const tab of tabs) {
        const day = tab && typeof tab === 'object' && typeof (tab as { date?: unknown }).date === 'string'
          ? (tab as { date: string }).date
          : ''
        const groups = (tab as { items?: unknown })?.items
        if (!Array.isArray(groups)) continue
        for (const g of groups) {
          const tracks = (g as { tracks?: unknown })?.tracks
          if (!Array.isArray(tracks)) continue
          for (const t of tracks) {
            const d = (t as { data?: { itemId?: { trackId?: unknown; albumId?: unknown } } })?.data?.itemId
            if (!d || d.trackId == null) continue
            out.push({
              type: 'track',
              id: { trackId: String(d.trackId), albumId: d.albumId != null ? String(d.albumId) : '' },
              timestamp: day ? `${day}T12:00:00Z` : undefined,
            })
          }
        }
      }
      if (out.length > 0) return out
    }
    // Старый формат: result.history = [HistoryItem...]
    // API отдаёт result.history КАК МАССИВ (иногда {items}) — выравниваем
    const h = res?.history
    if (Array.isArray(h)) return h as HistoryItem[]
    if (h && typeof h === 'object' && Array.isArray((h as { items?: unknown }).items)) {
      return (h as { items: HistoryItem[] }).items
    }
    return []
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