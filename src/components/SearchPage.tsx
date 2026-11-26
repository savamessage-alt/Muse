import { useEffect, useRef, useState } from 'react'
import { ymClient } from '../core/client'
import { expandTracks } from '../core/tracks'
import type { Album, Artist, Playlist, SearchResult, Track, TrackShort } from '../core/types'
import TrackList, { playTracks } from './TrackList'
import { AlbumCard, ArtistCard, Grid, PlaylistCard } from './cards'
import LoadingBlock from './LoadingBlock'
import { IconPlay, IconSearch, IconX } from './icons'

const SEARCH_HISTORY_KEY = 'muse.search.history'
const MAX_HISTORY = 8

function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter((x) => typeof x === 'string').slice(0, MAX_HISTORY)
  } catch {
    return []
  }
}
function saveSearchHistory(items: string[]): void {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)))
  } catch {
    /* ignore */
  }
}

type Tab = 'tracks' | 'albums' | 'artists' | 'playlists'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [tab, setTab] = useState<Tab>('tracks')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>(loadSearchHistory)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const suggestTimer = useRef<number | undefined>(undefined)
  const suggestRef = useRef<HTMLDivElement | null>(null)

  // закрыть подсказки при клике вне поля/списка
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const commitHistory = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, MAX_HISTORY)
      saveSearchHistory(next)
      return next
    })
  }

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResult(null)
      setTracks([])
      setErr(null)
      setLoading(false)
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    setLoading(true)
    setErr(null)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      try {
        const res = await ymClient.search(q, 'all')
        setResult(res)
        const shorts: TrackShort[] = res.tracks?.items ?? []
        const full = await expandTracks(shorts)
        setTracks(full)
        commitHistory(q)
      } catch (e) {
        setErr((e as Error).message)
      } finally {
        setLoading(false)
      }
    }, 450)
    return () => window.clearTimeout(timer.current)
  }, [query])

  // подсказки поиска (debounce 200мс)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    window.clearTimeout(suggestTimer.current)
    suggestTimer.current = window.setTimeout(async () => {
      try {
        const res = await ymClient.searchSuggest(q)
        const s = (res as { suggestions?: string[] })?.suggestions ?? []
        if (s.length > 0) {
          setSuggestions(s.slice(0, 8))
          setShowSuggestions(true)
        }
        // не затираем старые подсказки пустым ответом — список остаётся видимым
      } catch {
        /* игнорируем: оставляем предыдущие подсказки */
      }
    }, 200)
    return () => window.clearTimeout(suggestTimer.current)
  }, [query])

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'tracks', label: 'Треки', count: result?.tracks?.total },
    { id: 'albums', label: 'Альбомы', count: result?.albums?.total },
    { id: 'artists', label: 'Артисты', count: result?.artists?.total },
    { id: 'playlists', label: 'Плейлисты', count: result?.playlists?.total },
  ]

  const albums: Album[] = result?.albums?.items ?? []
  const artists: Artist[] = result?.artists?.items ?? []
  const playlists: Playlist[] = result?.playlists?.items ?? []

  return (
    <div ref={suggestRef}>
      <div className="search-bar">
        <IconSearch size={20} className="search-icon" />
        <input
          className="input search-input"
          placeholder="Треки, альбомы, артисты, плейлисты…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          aria-label="Поиск по музыке"
        />
        {query && (
          <button className="icon-btn small" onClick={() => setQuery('')} title="Очистить" aria-label="Очистить поиск">
            <IconX size={16} />
          </button>
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="search-suggest">
          {suggestions.map((s) => (
            <button
              key={s}
              className="search-suggest-item"
              onClick={() => {
                setQuery(s)
                setShowSuggestions(false)
              }}
            >
              <IconSearch size={14} /> {s}
            </button>
          ))}
        </div>
      )}
      {err && <div className="error-box"><p>{err}</p></div>}

      {!query.trim() && (
        <div className="search-empty-hint muted pad">
          Введите запрос, чтобы найти треки, альбомы, артистов и плейлисты.
          {history.length > 0 && (
            <div className="search-history">
              <div className="search-history-head">
                <span className="muted small">Недавние запросы</span>
                <button
                  className="link-btn small"
                  onClick={() => {
                    setHistory([])
                    saveSearchHistory([])
                  }}
                >
                  Очистить
                </button>
              </div>
              <div className="search-history-chips">
                {history.map((h) => (
                  <button
                    key={h}
                    className="chip"
                    onClick={() => setQuery(h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {query.trim() && (
        <>
          <div className="tabs" role="tablist" aria-label="Категории поиска">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={'tab' + (tab === t.id ? ' active' : '')}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {typeof t.count === 'number' ? <span className="tab-count">{t.count}</span> : null}
              </button>
            ))}
          </div>

          {loading && <div className="spinner" aria-label="Загрузка результатов поиска" />}

          {!loading && tab === 'tracks' && (
            <>
              {tracks.length > 0 && (
                <button className="primary-btn small" onClick={() => playTracks(tracks, 0, 'search')}>
                  <IconPlay size={14} /> Играть всё
                </button>
              )}
              <TrackList tracks={tracks} emptyText="Треки не найдены" />
            </>
          )}
          {tab === 'albums' && (
            loading ? (
              <LoadingBlock label="Загрузка альбомов" text="Загружаем альбомы…" />
            ) : albums.length > 0 ? (
              <Grid>
                {albums.map((a) => (
                  <AlbumCard key={a.id} album={a} />
                ))}
              </Grid>
            ) : (
              <p className="muted pad">Альбомы не найдены</p>
            )
          )}
          {tab === 'artists' && (
            loading ? (
              <LoadingBlock label="Загрузка артистов" text="Загружаем артистов…" />
            ) : artists.length > 0 ? (
              <Grid>
                {artists.map((a) => (
                  <ArtistCard key={a.id} artist={a} />
                ))}
              </Grid>
            ) : (
              <p className="muted pad">Артисты не найдены</p>
            )
          )}
          {tab === 'playlists' && (
            loading ? (
              <LoadingBlock label="Загрузка плейлистов" text="Загружаем плейлисты…" />
            ) : playlists.length > 0 ? (
              <Grid>
                {playlists.map((p) => (
                  <PlaylistCard key={p.kind} playlist={p} />
                ))}
              </Grid>
            ) : (
              <p className="muted pad">Плейлисты не найдены</p>
            )
          )}
        </>
      )}
    </div>
  )
}