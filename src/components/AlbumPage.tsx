import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ymClient } from '../core/client'
import { artistNames, coverUrl, PLACEHOLDER_COVER } from '../core/format'
import type { Album, Track } from '../core/types'
import TrackList, { playTracks } from './TrackList'

export default function AlbumPage() {
  const { id } = useParams<{ id: string }>()
  const [album, setAlbum] = useState<Album | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setAlbum(null)
    setTracks([])
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
  }, [id])

  if (err) return <div className="error-box"><p>{err}</p></div>
  if (!album) return <div className="spinner" />

  return (
    <div className="entity-page">
      <div className="entity-head">
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
          {tracks.length > 0 && (
            <button className="primary-btn" onClick={() => playTracks(tracks, 0, 'queue')}>
              ▶ Играть
            </button>
          )}
        </div>
      </div>
      <TrackList tracks={tracks} emptyText="Треки недоступны" />
    </div>
  )
}