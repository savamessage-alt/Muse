import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ymClient } from '../core/client'
import { coverUrl, PLACEHOLDER_COVER } from '../core/format'
import type { Album, Artist, BriefInfo, Track } from '../core/types'
import TrackList, { playTracks } from './TrackList'
import { AlbumCard, ArtistCard, Grid, Section } from './cards'
import { IconHeart, IconHeartFilled } from './icons'

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>()
  const [info, setInfo] = useState<BriefInfo | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [liked, setLiked] = useState(false)
  const [likedReady, setLikedReady] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    setInfo(null)
    setLiked(false)
    setLikedReady(false)
    ymClient
      .artistBriefInfo(id)
      .then((b) => setInfo(b))
      .catch((e) => setErr('Не удалось загрузить артиста: ' + (e as Error).message))
    // лайкнут ли исполнитель (новое API /likes/artists)
    ymClient
      .usersLikesArtists()
      .then((s) => {
        setLiked(s.has(String(id)))
        setLikedReady(true)
      })
      .catch(() => setLikedReady(true))
  }, [id])

  const toggleArtistLike = async () => {
    if (likeBusy || !id) return
    setLikeBusy(true)
    const next = !liked
    setLiked(next) // оптимистично
    try {
      if (next) await ymClient.artistsLikeAdd([id])
      else await ymClient.artistsLikeRemove([id])
    } catch {
      setLiked(!next)
    } finally {
      setLikeBusy(false)
    }
  }

  if (err) return <div className="error-box"><p>{err}</p></div>
  if (!info) return <div className="spinner" />

  const artist = info.artist
  const popular: Track[] = info.alsoTracks ?? []
  const albums: Album[] = info.albums ?? []
  const similar: Artist[] = info.similarArtists ?? []

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
          <div className="entity-actions">
            {popular.length > 0 && (
              <button className="primary-btn" onClick={() => playTracks(popular, 0, 'queue')}>
                ▶ Играть популярное
              </button>
            )}
            {likedReady && (
              <button
                className={'icon-btn liked-outline' + (liked ? ' on' : '')}
                onClick={() => void toggleArtistLike()}
                disabled={likeBusy}
                title={liked ? 'Убрать из лайкнутых исполнителей' : 'Лайкнуть исполнителя'}
              >
                {liked ? <IconHeartFilled size={20} /> : <IconHeart size={20} />}
              </button>
            )}
          </div>
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

      {similar.length > 0 && (
        <Section title="Похожие исполнители">
          <Grid>
            {similar.slice(0, 12).map((a) => (
              <ArtistCard key={a.id} artist={a} />
            ))}
          </Grid>
        </Section>
      )}
    </div>
  )
}