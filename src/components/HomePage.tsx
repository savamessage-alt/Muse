import { useEffect, useState } from 'react'
import { ymClient } from '../core/client'
import { useApp } from '../state/store'
import type { Album, Feed, Playlist, Track } from '../core/types'
import TrackList from './TrackList'
import { AlbumCard, Grid, PlaylistCard, Section } from './cards'

export default function HomePage() {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const ownPlaylists = useApp((s) => s.playlists)
  const [recommended, setRecommended] = useState<Track[]>([])

  useEffect(() => {
    ymClient
      .feed()
      .then((f) => {
        setFeed(f)
        const tracks = (f.days ?? [])
          .flatMap((d) => d.events ?? [])
          .map((e) => e.track)
          .filter((t): t is Track => !!t?.id)
        setRecommended(tracks.slice(0, 50))
      })
      .catch((e) => setErr('Не удалось загрузить ленту: ' + (e as Error).message))
  }, [])

  const albums = (feed?.days ?? [])
    .flatMap((d) => d.events ?? [])
    .map((e) => e.album)
    .filter((a): a is Album => !!a?.id)
  const uniqAlbums = [...new Map(albums.map((a) => [a.id, a])).values()].slice(0, 20)

  const eventPlaylists = (feed?.days ?? [])
    .flatMap((d) => d.events ?? [])
    .map((e) => e.playlist)
    .filter((p): p is Playlist => !!p?.kind)
  const uniqPlaylists = [...new Map(eventPlaylists.map((p) => [p.kind, p])).values()].slice(0, 12)

  return (
    <div>
      <h1 className="page-title">Добро пожаловать!</h1>
      {err && <div className="error-box"><p>{err}</p></div>}

      {uniqPlaylists.length > 0 && (
        <Section title="Плейлисты дня">
          <Grid>
            {uniqPlaylists.map((p) => (
              <PlaylistCard key={p.kind} playlist={p} />
            ))}
          </Grid>
        </Section>
      )}

      {uniqAlbums.length > 0 && (
        <Section title="Новинки">
          <Grid>
            {uniqAlbums.map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </Grid>
        </Section>
      )}

      {ownPlaylists.length > 0 && (
        <Section title="Мои плейлисты">
          <Grid>
            {ownPlaylists.slice(0, 12).map((p) => (
              <PlaylistCard key={p.kind} playlist={p} />
            ))}
          </Grid>
        </Section>
      )}

      <Section title="Рекомендуем">
        <TrackList tracks={recommended} />
      </Section>
    </div>
  )
}