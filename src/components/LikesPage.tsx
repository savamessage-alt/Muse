import { useEffect, useState } from 'react'
import { ymClient } from '../core/client'
import { expandTracks } from '../core/tracks'
import type { Track, TrackShort } from '../core/types'
import TrackList, { playTracks } from './TrackList'
import { diag } from '../core/diag'

export default function LikesPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ymClient
      .usersLikesTracks()
      .then(async (shorts) => {
        diag('likes: записей=' + shorts.length + ' первая=' + JSON.stringify(shorts[0] ?? {}).slice(0, 100))
        const full = await expandTracks(shorts as (Track | TrackShort)[])
        if (alive) setTracks(full)
      })
      .catch((e) => {
        diag('likes: ОШИБКА ' + String((e as Error)?.message ?? e).slice(0, 120))
        if (alive) setErr('Не удалось загрузить: ' + (e as Error).message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
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
      <TrackList tracks={tracks} loading={loading} emptyText="Пока нет понравившихся треков" />
    </div>
  )
}