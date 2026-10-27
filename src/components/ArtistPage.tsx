import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ymClient } from '../core/client'
import { coverUrl, PLACEHOLDER_COVER } from '../core/format'
import type { Album, BriefInfo, Track } from '../core/types'
import TrackList, { playTracks } from './TrackList'
import { AlbumCard, Grid, Section } from './cards'

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>()
  const [info, setInfo] = useState<BriefInfo | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setInfo(null)
    ymClient
      .artistBriefInfo(id)
      .then((b) => setInfo(b))
      .catch((e) => setErr('Не удалось загрузить артиста: ' + (e as Error).message))
  }, [id])

  if (err) return <div className="error-box"><p>{err}</p></div>
  if (!info) return <div className="spinner" />

  const artist = info.artist
  const popular: Track[] = info.alsoTracks ?? []
  const albums: Album[] = info.albums ?? []

  return (
    <div className="entity-page">
      <div className="entity-head">
        <img
          className="entity-cover round"
          src={coverUrl(artist?.cover?.uri, '300x300') ?? PLACEHOLDER_COVER}
          alt=""
          onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
        />
        <div className="entity-info">
          <div className="entity-type">Артист</div>
          <h1 className="entity-title">{artist?.name ?? 'Артист'}</h1>
          <div className="entity-sub">
            {artist?.counts?.tracks ? artist.counts.tracks + ' треков' : ''}
            {artist?.counts?.albums ? ' · ' + artist.counts.albums + ' альбомов' : ''}
          </div>
          {popular.length > 0 && (
            <button className="primary-btn" onClick={() => playTracks(popular, 0, 'queue')}>
              ▶ Играть популярное
            </button>
          )}
        </div>
      </div>

      {popular.length > 0 && (
        <Section title="Популярные треки">
          <TrackList tracks={popular} />
        </Section>
      )}

      {albums.length > 0 && (
        <Section title="Альбомы">
          <Grid>
            {albums.slice(0, 20).map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </Grid>
        </Section>
      )}
    </div>
  )
}