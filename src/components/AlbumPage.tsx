import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ymClient } from '../core/client'
import { artistNames, coverUrl, PLACEHOLDER_COVER } from '../core/format'
import EmptyState from './EmptyState'
import { IconMusicNote } from './icons'
import type { Album, Track } from '../core/types'
import TrackList, { playTracks } from './TrackList'
import { IconBack, IconHeart, IconHeartFilled, IconPlay } from './icons'

export default function AlbumPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [album, setAlbum] = useState<Album | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [liked, setLiked] = useState(false)
  const [likedReady, setLikedReady] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    setAlbum(null)
    setTracks([])
    setLiked(false)
    setLikedReady(false)
    ymClient
      .albumWithTracks(id)
      .then((a) => {
        setAlbum(a)
        const volumes = a.tracks?.volumes ?? []
        if (volumes.length) {
          setTracks(volumes.flat())
        } else {
          setTracks((a.tracks?.volumes as unknown as Track[]) ?? [])
        }
      })
      .catch((e) => setErr('Не удалось загрузить альбом: ' + (e as Error).message))
    // лайкнут ли альбом (новое API /likes/albums)
    ymClient
      .usersLikesAlbums()
      .then((s) => {
        setLiked(s.has(String(id)))
        setLikedReady(true)
      })
      .catch(() => setLikedReady(true))
  }, [id])

  const toggleAlbumLike = async () => {
    if (likeBusy || !id) return
    setLikeBusy(true)
    const next = !liked
    setLiked(next) // оптимистично
    try {
      if (next) await ymClient.albumsLikeAdd([id])
      else await ymClient.albumsLikeRemove([id])
    } catch {
      setLiked(!next)
    } finally {
      setLikeBusy(false)
    }
  }

  if (err) return (
    <div className="error-box">
      <p>{err}</p>
      <button className="btn small" onClick={() => void window.location.reload()}>Повторить</button>
    </div>
  )
  if (!album) return <div className="spinner" />

  return (
    <div className="entity-page">
      <div className="entity-head">
        <button className="icon-btn small" title="Назад" aria-label="Назад" onClick={() => nav(-1)}>
          <IconBack size={16} />
        </button>
        <img
          className="entity-cover"
          src={coverUrl(album.coverUri, '300x300') ?? PLACEHOLDER_COVER}
          alt=""
          onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
        />
        <div className="entity-info">
          <div className="entity-type">Альбом</div>
          <h1 className="entity-title">{album.title}</h1>
          <div className="entity-sub">
            {artistNames(album.artists)}
            {album.year ? ' · ' + album.year : ''}
            {tracks.length ? ' · ' + tracks.length + ' треков' : ''}
          </div>
          <div className="entity-actions">
            {tracks.length > 0 && (
              <button className="primary-btn" onClick={() => playTracks(tracks, 0, 'queue')}>
                <IconPlay size={16} /> Играть
              </button>
            )}
            {likedReady && (
              <button
                className={'icon-btn liked-outline' + (liked ? ' on' : '')}
                onClick={() => void toggleAlbumLike()}
                disabled={likeBusy}
                title={liked ? 'Убрать лайк с альбома' : 'Лайкнуть альбом'}
              >
                {liked ? <IconHeartFilled size={20} /> : <IconHeart size={20} />}
              </button>
            )}
          </div>
        </div>
      </div>
      {tracks.length === 0 && (
        <EmptyState
          icon={<IconMusicNote size={48} />}
          title="Треки недоступны"
          subtitle="В этом альбоме нет доступных треков"
          actionLabel="Вернуться назад"
          onAction={() => nav(-1)}
        />
      )}
      <TrackList tracks={tracks} emptyText="Треки недоступны" />
    </div>
  )
}