import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ymClient } from '../core/client'
import { expandTracks } from '../core/tracks'
import { coverUrl, formatCount, PLACEHOLDER_COVER } from '../core/format'
import type { Playlist, Track, TrackShort } from '../core/types'
import TrackList, { playTracks } from './TrackList'

export default function PlaylistPage() {
  const { kind } = useParams<{ kind: string }>()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!kind) return
    setPlaylist(null)
    setTracks([])
    ymClient
      .playlist(kind)
      .then(async (pl) => {
        setPlaylist(pl)
        if (pl?.tracks) {
          const full = await expandTracks(pl.tracks as (Track | TrackShort)[])
          setTracks(full)
        }
      })
      .catch((e) => setErr('Не удалось загрузить плейлист: ' + (e as Error).message))
  }, [kind])

  if (err) return <div className="error-box"><p>{err}</p></div>
  if (!playlist) return <div className="spinner" />

  const uri = playlist.cover?.uri ?? playlist.coverUri
  const totalDur = tracks.reduce((s, t) => s + (t.durationMs ?? 0), 0)

  return (
    <div className="entity-page">
      <div className="entity-head">
        <img
          className="entity-cover"
          src={coverUrl(uri, '300x300') ?? PLACEHOLDER_COVER}
          alt=""
          onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
        />
        <div className="entity-info">
          <div className="entity-type">Плейлист</div>
          <h1 className="entity-title">{playlist.title ?? 'Без названия'}</h1>
          <div className="entity-sub">
            {playlist.owner?.name ? playlist.owner.name + ' · ' : ''}
            {tracks.length ? formatCount(tracks.length) + ' треков' : ''}
            {totalDur ? ' · ' + Math.round(totalDur / 60000) + ' мин' : ''}
          </div>
          {tracks.length > 0 && (
            <button className="primary-btn" onClick={() => playTracks(tracks, 0, 'playlist')}>
              ▶ Играть
            </button>
          )}
        </div>
      </div>

      <TrackList tracks={tracks} emptyText="В плейлисте нет треков" />
    </div>
  )
}