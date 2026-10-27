import { useEffect, useState } from 'react'
import { ymClient } from '../core/client'
import { useApp } from '../state/store'
import { player } from '../core/player'
import { coverUrl, PLACEHOLDER_COVER } from '../core/format'
import type { Album, Feed, Playlist, Track } from '../core/types'
import TrackList from './TrackList'
import { AlbumCard, Grid, PlaylistCard, Section } from './cards'

interface Premiere {
  kind: number
  ownerUid: number
  title: string
  cover?: string
  trackCount?: number
  description?: string
}

export default function HomePage() {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const ownPlaylists = useApp((s) => s.playlists)
  const [recommended, setRecommended] = useState<Track[]>([])
  const [premieres, setPremieres] = useState<Premiere[]>([])
  const [loadingPl, setLoadingPl] = useState<number | null>(null)

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
        // «Премьеры» из ленты — готовые плейлисты с треками (для быстрого прослушивания)
        const pls: Premiere[] = []
        for (const g of f.generatedPlaylists ?? []) {
          if (g.data?.kind !== undefined && g.data?.owner?.uid !== undefined) {
            pls.push({
              kind: g.data.kind,
              ownerUid: g.data.owner.uid,
              title: g.data.title ?? 'Плейлист',
              cover: g.data.cover?.uri ?? g.data.ogImage,
              trackCount: g.data.trackCount,
              description: g.data.description,
            })
          }
        }
        setPremieres(pls)
      })
      .catch((e) => setErr('Не удалось загрузить ленту: ' + (e as Error).message))
  }, [])

  const playPremiere = async (p: Premiere) => {
    setLoadingPl(p.kind)
    try {
      const tracks = await ymClient.playlistTracks(p.ownerUid, p.kind)
      if (tracks.length) void player.playQueue(tracks.map((t) => ({ track: t, source: 'playlist' })), 0)
    } finally {
      setLoadingPl(null)
    }
  }

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

      {premieres.length > 0 && (
        <Section title="Новинки и Премьеры">
          <div className="premieres">
            {premieres.map((p) => (
              <button
                key={p.kind}
                className="premiere-card"
                onClick={() => void playPremiere(p)}
                disabled={loadingPl === p.kind}
              >
                <img
                  src={coverUrl(p.cover) ?? PLACEHOLDER_COVER}
                  alt=""
                  className="premiere-cover"
                  onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
                />
                <span className="premiere-info">
                  <span className="premiere-title">{p.title ?? 'Плейлист'}</span>
                  <span className="muted small">
                    {p.trackCount ? `${p.trackCount} треков` : ''} · нажмите, чтобы слушать
                  </span>
                </span>
                <span className="premiere-play">{loadingPl === p.kind ? '…' : '▶ Слушать'}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Рекомендуем">
        <TrackList tracks={recommended} />
      </Section>
    </div>
  )
}