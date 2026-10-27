import { useEffect, useRef, useState } from 'react'
import { ymClient } from '../core/client'
import { expandTracks } from '../core/tracks'
import type { Album, Artist, Playlist, SearchResult, Track, TrackShort } from '../core/types'
import TrackList, { playTracks } from './TrackList'
import { AlbumCard, ArtistCard, Grid, PlaylistCard } from './cards'
import { IconSearch, IconX } from './icons'

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
      return
    }
    setLoading(true)
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
    { id: 'albums', label: 'Альбомы', count: result?.albums?.total ?? 0 },
    { id: 'artists', label: 'Артисты', count: result?.artists?.total ?? 0 },
    { id: 'playlists', label: 'Плейлисты', count: result?.playlists?.total ?? 0 },
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
        />
        {query && (
          <button className="icon-btn small" onClick={() => setQuery('')} title="Очистить">
            <IconX size={16} />
          </button>
        )}
      </div>
      {err && <div className="error-box"><p>{err}</p></div>}

      {query.trim() && (
        <>
          <div className="tabs">
            {tabs.map((t) => (
              <button key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
                {t.label}
                {t.count ? <span className="tab-count">{t.count}</span> : null}
              </button>
            ))}
          </div>

          {loading && <div className="spinner" />}

          {!loading && tab === 'tracks' && (
            <>
              {tracks.length > 0 && (
                <button className="primary-btn small" onClick={() => playTracks(tracks, 0, 'search')}>
                  ▶ Играть всё
                </button>
              )}
              <TrackList tracks={tracks} emptyText="Треки не найдены" />
            </>
          )}
          {!loading && tab === 'albums' && (
            <Grid>
              {albums.map((a) => (
                <AlbumCard key={a.id} album={a} />
              ))}
            </Grid>
          )}
          {!loading && tab === 'artists' && (
            <Grid>
              {artists.map((a) => (
                <ArtistCard key={a.id} artist={a} />
              ))}
            </Grid>
          )}
          {!loading && tab === 'playlists' && (
            <Grid>
              {playlists.map((p) => (
                <PlaylistCard key={p.kind} playlist={p} />
              ))}
            </Grid>
          )}
        </>
      )}
    </div>
  )
}