// ============================================================
// Модели данных API Яндекс Музыки (упрощённые типы)
// Источник: OpenAPI-спека MarshalX/yandex-music-api
// ============================================================

export interface ArtistBrief {
  id: number
  name: string
  various?: boolean
  composer?: boolean
  cover?: Cover | null
  genres?: string[]
  counts?: { tracks?: number; albums?: number }
}

export interface Cover {
  type?: string
  uri?: string
  dir?: string
  version?: string
  itemsUri?: string[]
  customUri?: string
  error?: string
}

/** URL обложки по размеру (поддерживает относительные и абсолютные URI) */
export function coverUrl(uri: string | undefined | null, size = '200x200'): string | undefined {
  if (!uri) return undefined
  let u = uri.trim()
  if (u.startsWith('//')) u = 'https:' + u
  else if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  return u.replace(/%%/g, size)
}

/** Составной ключ трека «trackId:albumId» */
export function trackKey(track: Pick<Track, 'id' | 'albums' | 'albumId'>): string {
  const albumId = track.albums?.[0]?.id ?? track.albumId ?? ''
  return `${track.id}:${albumId}`
}

export interface Track {
  id: string
  title: string
  available?: boolean
  availableAsRbt?: boolean
  lyricsAvailable?: string | null
  type?: 'music' | 'podcast' | 'video'
  coverUri?: string
  durationMs?: number
  explicit?: boolean
  regions?: string[]
  artists?: ArtistBrief[]
  albums?: { id: string; title?: string; coverUri?: string; trackPosition?: { volume?: number; index?: number } }[]
  trackSource?: string
  major?: { id?: number; name?: string }
  disclaimers?: string[]
  metaData?: { lyrics?: string }
  shortDescription?: string
  ogImage?: string
  versions?: { original?: unknown; alternative?: unknown; companion?: unknown[] }
  albumId?: string
}

export interface TrackShort {
  id: string
  albumId: string
  timestamp?: string
}

export interface TracksList {
  pager?: { total: number; page?: number; perPage?: number } | null
  items: TrackShort[]
}

export interface Album {
  id: string
  title: string
  year?: number
  releaseDate?: string
  trackCount?: number
  genre?: string
  genres?: string[]
  coverUri?: string
  artists?: ArtistBrief[]
  trackPosition?: { volume?: number; index?: number }
  tracks?: { pager?: unknown; volumes?: Track[][] }
}

export interface Artist {
  id: string
  name: string
  cover?: Cover | null
  counts?: { tracks?: number; albums?: number }
  genres?: string[]
  various?: boolean
  composer?: boolean
  decomposed?: { decomposed?: { composer?: unknown }[] }
  available?: boolean
  description?: string
  likesCount?: number
  vanityUrls?: string[]
  ratings?: { month?: number; week?: number; day?: number }
  link?: { href?: string; title?: string }
}

export interface ArtistLink {
  title?: string
  href?: string
  subtitle?: string
  url?: string
  type?: string
  socialNetwork?: string
}

export interface BriefInfo {
  artist?: Artist
  albums?: Album[]
  alsoAlbums?: Album[]
  alsoTracks?: Track[]
  /** реальные популярные треки артиста (alsoTracks часто пуст) */
  popularTracks?: Track[]
  similarArtists?: Artist[]
  counts?: { tracks?: number; directAlbums?: number; alsoTracks?: number; alsoAlbums?: number }
  vinyls?: unknown[]
  playlists?: { kind?: number; title?: string; trackCount?: number; owner?: { uid?: number; login?: string } }[]
  /** ссылки (сайт/соцсети) */
  links?: ArtistLink[]
  /** статистика прослушиваний */
  stats?: { lastMonthListeners?: number; lastMonthListenersDelta?: number }
  /** «Моя волна по исполнителю» */
  customWave?: { title?: string; header?: string; backgroundImageUrl?: string }
  videos?: unknown[]
  concerts?: unknown[]
  lastReleases?: Album[]
}

export interface Playlist {
  kind?: string
  owner?: { uid?: number; login?: string; name?: string }
  title?: string
  trackCount?: number
  cover?: Cover | null
  coverUri?: string
  createdAt?: string
  modifiedAt?: string
  /** ревизия для операций change (растёт с каждым изменением) */
  revision?: number
  durationMs?: number
  playCounter?: number
  tags?: string[]
  isBanner?: boolean
  isPremiere?: boolean
  isAvailable?: boolean
  isForFrom?: boolean
  isForChildren?: boolean
  ogImage?: string
  tracks?: TrackShort[]
  backgroundImageUrl?: string
  description?: string
  customWave?: { colorCss?: string; imgSrc?: string }
}

export interface User {
  uid?: number
  login?: string
  name?: string
  displayName?: string
  firstName?: string
  secondName?: string
  sex?: string
  verified?: boolean
  coverUri?: string
  region?: number
  regionCode?: string
  fullName?: string
}

export interface AccountStatus {
  account?: User & { plus?: unknown; hasPlus?: boolean }
  permissions?: { until?: string; values?: string[] }
  subscription?: {
    autoRenewable?: unknown
    canStartTrial?: boolean
    mcdonaldIsAvailable?: boolean
    end?: string
    expired?: boolean
    fake?: boolean
    features?: string[]
    hadAnyTrial?: boolean
    hadPlus?: boolean
    product?: { productId?: string; type?: string }
    productId?: string
    start?: string
    subscriptionAvailablity?: string
    trialDuration?: number
  }
  region?: number
  plus?: { hasPlus?: boolean }
}

export interface SearchResult {
  best?: {
    type?: string
    result?: unknown
    text?: string
  }
  albums?: { total?: number; items?: Album[] }
  artists?: { total?: number; items?: Artist[] }
  playlists?: { total?: number; items?: Playlist[] }
  tracks?: { total?: number; perPage?: number; items?: TrackShort[] }
  podcasts?: unknown
  videos?: unknown
  searchRequestId?: string
}

export interface FeedEvent {
  type?: string
  track?: Track
  album?: Album
  playlist?: Playlist
  artist?: Artist
  typeForFrom?: string
}

export interface Feed {
  pager?: unknown
  days?: { day?: string; events?: FeedEvent[] }[]
  canGetMoreEvents?: boolean
  generatedPlaylists?: {
    type?: string
    ready?: boolean
    notify?: boolean
    data?: {
      owner?: { uid?: number; login?: string }
      kind?: number
      title?: string
      description?: string
      cover?: { uri?: string }
      ogImage?: string
      trackCount?: number
    }
  }[]
}

/** Блок лендинга /landing3 (подборки, новинки, чарт и т.д.) */
export interface LandingBlock {
  type?: string
  id?: string
  entities?: {
    type?: string
    id?: string
    data?: {
      kind?: number
      title?: string
      trackCount?: number
      cover?: { uri?: string } | null
      owner?: { uid?: number }
      playlist?: { kind?: number; title?: string; trackCount?: number; cover?: { uri?: string } | null; owner?: { uid?: number } }
    }
  }[]
}

/** Плейлист «Чарт» из /landing3/chart: треки — записи {track, playCount} */
export interface ChartPlaylist {
  title?: string
  kind?: number
  owner?: { uid?: number }
  trackCount?: number
  tracks?: { track?: TrackShort; playCount?: number; recent?: boolean }[]
}

export interface FileDownloadInfo {
  codec?: 'mp3' | 'aac' | 'hls' | 'flac' | 'wav' | string
  bitrateInKbps?: number
  directLink?: string
  url?: string
  /** XML-ссылка на параметры загрузки (источник для подписи get-mp3) */
  downloadInfoUrl?: string
  direct?: boolean
  restriction?: unknown
  init?: { fileName?: string }
}

export interface DownloadInfo {
  s?: string
  ts?: number
  host?: string
  path?: string
  region?: number
  items?: FileDownloadInfo[]
  version?: string
}

export interface LyricsInfo {
  id?: number
  available?: boolean
  major?: { id?: number; name?: string }
  lang?: string | null
  coverUri?: string | null
  lyrics?: string | null
}

export interface Supplement {
  id?: string
  lyrics?: LyricsInfo
  videos?: { type?: string; url?: string; name?: string }[]
  radioIsAvailable?: boolean
  similarTracks?: { id?: string; title?: string; artists?: ArtistBrief[] }[]
}

export interface HistoryItem {
  id?: { trackId?: string; albumId?: string; playlistId?: string[]; tag?: string }
  type?: 'playlist' | 'track'
  title?: string
  subtitle?: string
  coverUri?: string
  timestamp?: string
}

export interface RadioStation {
  station?: {
    id?: { type?: string; tag?: string }
    name?: string
    icon?: Cover | null
  }
  id?: { type?: string; tag?: string }
  type?: string
  context?: { context?: string; step?: string }
}

export type RadioFeedback =
  | 'radioStarted'
  | 'radioFinished'
  | 'settingsChanged'
  | 'like'
  | 'dislike'
  | 'skip'
  | 'play'
  | 'trackStarted'
  | 'trackFinished'

export interface RadioSequenceTrack {
  track?: Track
  type?: 'track' | 'interactive'
  playedFraction?: number
}

export interface RadioSessionResume {
  sequence?: RadioSequenceTrack[]
  batchId?: string
  sessionId?: string
  radioSessionId?: string
  firstTrackId?: string | null
  playId?: string
}

export interface QueueItem {
  id?: string | number
  albumId?: string | number
  type?: 'track' | 'artist' | 'album' | 'playlist' | 'radio' | 'pending' | 'skip' | 'ad'
  playId?: string
  source?: string
}

export interface Queue {
  context?: string
  modified?: { type?: string; objectId?: string }
  items?: QueueItem[]
  currentIndex?: number
  fetchDate?: string
  id?: string | number
}

// ---- Ynison (черновые типы, наполняются после исследования) ----
export interface YnisonState {
  player?: {
    status?: {
      playing?: boolean
      durationMs?: number
      progressMs?: number
      playable?: { playId?: string; type?: string }
    }
    state?: { entityId?: string }
  }
  connected?: boolean
}