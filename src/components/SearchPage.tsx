import { useEffect, useRef, useState } from 'react'
import { ymClient } from '../core/client'
import { expandTracks } from '../core/tracks'
import type { Album, Artist, Playlist, SearchResult, Track, TrackShort } from '../core/types'
import TrackList, { playTracks } from './TrackList'
import { AlbumCard, ArtistCard, Grid, PlaylistCard } from './cards'
import { IconPlay, IconSearch, IconX } from './icons'

type Tab = 'tracks' | 'albums' | 'artists' | 'playlists'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [tab, setTab] = useState<Tab>('tracks')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResult(null)
      setTracks([])
      setErr(null)
      setLoading(false)
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
      } catch (e) {
        setErr((e as Error).message)
      } finally {
        setLoading(false)
      }
    }, 450)
    return () => window.clearTimeout(timer.current)
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
    <div>
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
      {err && <div className="error-box"><p>{err}</p></div>}

      {!query.trim() && (
        <div className="search-empty-hint muted pad">
          Введите запрос, чтобы найти треки, альбомы, артистов и плейлисты.
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
              <div className="list-loading" role="status" aria-label="Загрузка альбомов">
                <div className="spinner" />
                <span className="muted small">Загружаем альбомы…</span>
              </div>
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
              <div className="list-loading" role="status" aria-label="Загрузка артистов">
                <div className="spinner" />
                <span className="muted small">Загружаем артистов…</span>
              </div>
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
              <div className="list-loading" role="status" aria-label="Загрузка плейлистов">
                <div className="spinner" />
                <span className="muted small">Загружаем плейлисты…</span>
              </div>
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