import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ymClient } from '../core/client'
import { expandTracks } from '../core/tracks'
import { coverUrl, formatCount, PLACEHOLDER_COVER } from '../core/format'
import type { Playlist, Track, TrackShort } from '../core/types'
import { useApp } from '../state/store'
import TrackList, { playTracks } from './TrackList'
import { IconBack, IconPlay, IconTrash, IconX } from './icons'
import EmptyState from './EmptyState'
import { IconMusicNote } from './icons'

export default function PlaylistPage() {
  const { kind } = useParams<{ kind: string }>()
  const nav = useNavigate()

  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const removeFromPlaylist = useApp((s) => s.removeFromPlaylist)
  const deletePlaylist = useApp((s) => s.deletePlaylist)

  useEffect(() => {
    if (!kind) return
    setPlaylist(null)
    setTracks([])
    ymClient
      .playlist(kind)
      .then(async (pl) => {
        setPlaylist(pl)
        // API может вернуть записи двух видов: плоские {id, albumId} или
        // с вложенным полным треком {id, track}. Нормализуем оба.
        const raw = (pl?.tracks ?? []) as unknown as {
          track?: Track | TrackShort | null
          id?: string | number
          albumId?: string | number
        }[]
        const normalized: (Track | TrackShort)[] = raw
          .map((r) => {
            if (r?.track) return r.track
            if (r?.id != null) return { id: String(r.id), albumId: r.albumId != null ? String(r.albumId) : '' }
            return null
          })
          .filter((x): x is Track | TrackShort => !!x)
        const full = await expandTracks(normalized)
        setTracks(full)
      })
      .catch((e) => setErr('Не удалось загрузить плейлист: ' + (e as Error).message))
  }, [kind])

  const onRemove = async (i: number) => {
    if (!kind) return
    const ok = await removeFromPlaylist(i, kind)
    if (ok) setTracks((ts) => ts.filter((_, idx) => idx !== i))
  }

  const onDeletePlaylist = async () => {
    if (!kind) return
    setConfirmDel(false)
    await deletePlaylist(kind)
    nav('/playlists')
  }

  if (err) return (
    <div className="error-box">
      <p>{err}</p>
      <button className="btn small" onClick={() => void window.location.reload()}>Повторить</button>
    </div>
  )
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
          <div className="entity-actions">
            {tracks.length > 0 && (
              <button className="primary-btn" onClick={() => playTracks(tracks, 0, 'playlist')}>
                <IconPlay size={16} /> Играть
              </button>
            )}
            <button className="delete-playlist-btn" onClick={() => setConfirmDel(true)} title="Удалить плейлист">
              <IconTrash size={15} /> Удалить плейлист
            </button>
          </div>
        </div>
      </div>

      <TrackList
        tracks={tracks}
        emptyText="В плейлисте нет треков"
        removeFromPlaylist={onRemove}
      />

      {confirmDel && (
        <div className="confirm-overlay" onClick={() => setConfirmDel(false)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Удаление плейлиста">
            <div className="confirm-head">
              <span className="muted small">Удаление</span>
              <button className="panel-close" onClick={() => setConfirmDel(false)} title="Закрыть" aria-label="Закрыть">
                <IconX size={16} />
              </button>
            </div>
            <div className="confirm-title">Удалить плейлист?</div>
            <div className="confirm-text">
              «{playlist.title ?? 'Без названия'}» будет удалён навсегда — треки из «Избранного» и библиотеки не пропадут.
            </div>
            <div className="confirm-actions">
              <button className="primary-btn ghost" onClick={() => setConfirmDel(false)}>
                Отмена
              </button>
              <button className="primary-btn danger" onClick={() => void onDeletePlaylist()}>
                <IconTrash size={15} /> Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}