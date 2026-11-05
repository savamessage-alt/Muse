import { useEffect, useState } from 'react'
import { ymClient } from '../core/client'
import { expandTracks } from '../core/tracks'
import { useApp } from '../state/store'
import type { Track, TrackShort } from '../core/types'
import { plural } from '../core/format'
import TrackList, { playTracks } from './TrackList'
import { PlaylistCard, Section } from './cards'
import { diag } from '../core/diag'

/**
 * «Избранное»: сверху — лента «Моих плейлистов» (открываются отдельной
 * страницей), ниже — избранные треки (лайки).
 */
export default function FavoritesPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const playlists = useApp((s) => s.playlists)

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
          <h1 className="entity-title">Избранное</h1>
          <div className="entity-sub">
            {playlists.length > 0
              ? playlists.length + ' ' + plural(playlists.length, 'плейлист', 'плейлиста', 'плейлистов')
              : ''}
            {playlists.length > 0 && tracks.length > 0 ? ' · ' : ''}
            {tracks.length > 0 ? tracks.length + ' ' + plural(tracks.length, 'трек', 'трека', 'треков') : ''}
          </div>
          {tracks.length > 0 && (
            <button className="primary-btn" onClick={() => playTracks(tracks, 0, 'queue')}>
              ▶ Играть всё
            </button>
          )}
        </div>
      </div>

      {playlists.length > 0 && (
        <Section title="Мои плейлисты">
          <div className="fav-row">
            {playlists.slice(0, 30).map((pl) => (
              <PlaylistCard key={pl.kind} playlist={pl} />
            ))}
          </div>
        </Section>
      )}

      {err && <div className="error-box"><p>{err}</p></div>}

      <Section title={'Избранные треки' + (tracks.length ? ` · ${tracks.length}` : '')}>
        <TrackList tracks={tracks} loading={loading} emptyText="Пока нет избранных треков" />
      </Section>
    </div>
  )
}