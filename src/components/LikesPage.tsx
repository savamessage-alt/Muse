import { useEffect, useState } from 'react'
import { ymClient } from '../core/client'
import { expandTracks } from '../core/tracks'
import type { Track, TrackShort } from '../core/types'
import TrackList, { playTracks } from './TrackList'

export default function LikesPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ymClient
      .usersLikesTracks()
      .then(async (shorts) => {
        const full = await expandTracks(shorts as (Track | TrackShort)[])
        setTracks(full)
      })
      .catch((e) => setErr('Не удалось загрузить: ' + (e as Error).message))
  }, [])

  return (
    <div className="entity-page">
      <div className="entity-head">
        <div className="entity-info">
          <div className="entity-type">Коллекция</div>
          <h1 className="entity-title">Мне нравится</h1>
          <div className="entity-sub">{tracks.length ? tracks.length + ' треков' : ''}</div>
          {tracks.length > 0 && (
            <button className="primary-btn" onClick={() => playTracks(tracks, 0, 'queue')}>
              ▶ Играть всё
            </button>
          )}
        </div>
      </div>
      {err && <div className="error-box"><p>{err}</p></div>}
      <TrackList tracks={tracks} emptyText="Пока нет понравившихся треков" />
    </div>
  )
}