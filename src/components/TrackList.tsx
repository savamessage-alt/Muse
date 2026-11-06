import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { player, type PlayableTrack } from '../core/player'
import { useApp } from '../state/store'
import { artistNames, coverUrl, formatMs, PLACEHOLDER_COVER } from '../core/format'
import type { Track } from '../core/types'
import { IconPlay, IconPause, IconHeart, IconHeartFilled, IconMore, IconList, IconPlus, IconTrash } from './icons'

interface Props {
  tracks: Track[]
  /** вызывается по клику на строку (по умолчанию — очередь с этого места) */
  onPlay?: (index: number) => void
  showAlbum?: boolean
  showLikes?: boolean
  emptyText?: string
  /** источник очереди при клике (radio/playlist/queue/…), по умолчанию queue */
  playSource?: PlayableTrack['source']
  /** пока идёт загрузка — спиннер вместо «пусто» (иначе мелькает «пока пусто») */
  loading?: boolean
  /** если задано — в меню появляется «Убрать из плейлиста» (индекс строки передаётся) */
  removeFromPlaylist?: (index: number) => void
}

/** Воспроизвести список с указанного индекса (по умолчанию) */
export function playTracks(tracks: Track[], index = 0, source: PlayableTrack['source'] = 'queue') {
  if (!tracks.length) return
  void player.playQueue(tracks.map((track) => ({ track, source })), index)
}

/** Меню действий с треком: добавить в плейлист (с выбором), создать плейлист,
 *  а в контексте плейлиста — убрать трек из него */
function TrackMenu({
  track,
  index,
  onRemoveFromPlaylist,
}: {
  track: Track
  index?: number
  onRemoveFromPlaylist?: (index: number) => void
}) {
  const playlists = useApp((s) => s.playlists)
  const addToPlaylist = useApp((s) => s.addToPlaylist)
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (kind: string) => {
    setOpen(false)
    void addToPlaylist(track, kind)
  }

  return (
    <div className="track-menu" ref={ref}>
      <button
        className={'icon-btn small' + (open ? ' active' : '')}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        title="Действия с треком"
        aria-label="Действия с треком"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <IconMore size={16} />
      </button>
      {open && (
        <div className="track-menu-pop" role="menu" onClick={(e) => e.stopPropagation()}>
          {onRemoveFromPlaylist && index != null && (
            <button
              className="track-menu-item danger"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onRemoveFromPlaylist(index)
              }}
            >
              <IconTrash size={15} /> Убрать из плейлиста
            </button>
          )}
          <div className="track-menu-title">Добавить в плейлист</div>
          <div className="track-menu-list">
            {playlists.length === 0 && <div className="muted small track-menu-empty">Плейлистов пока нет</div>}
            {playlists.slice(0, 40).map((pl) => (
              <button
                key={pl.kind}
                className="track-menu-item"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation()
                  pick(String(pl.kind))
                }}
              >
                <IconList size={15} />
                <span className="track-menu-item-name">{pl.title || 'Без названия'}</span>
                {pl.trackCount != null && <span className="muted small">{pl.trackCount}</span>}
              </button>
            ))}
            <button
              className="track-menu-item create"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                nav('/playlists')
              }}
            >
              <IconPlus size={15} /> Создать плейлист
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TrackList({ tracks, onPlay, showAlbum = true, showLikes = true, emptyText, playSource = 'queue', loading, removeFromPlaylist }: Props) {
  const [snap, setSnap] = useState(() => player.snapshot())
  useEffect(() => player.onChange(setSnap), [])
  const isLiked = useApp((s) => s.isLiked)
  const toggleLike = useApp((s) => s.toggleLike)

  if (loading) {
    return (
      <div className="list-loading" role="status" aria-label="Загрузка">
        <div className="spinner" />
        <span className="muted small">Загружаем…</span>
      </div>
    )
  }

  if (!tracks.length) {
    return <div className="muted pad">{emptyText ?? 'Здесь пока пусто'}</div>
  }

  return (
    <div className="tracklist">
      <div className="trackrow trackhead">
        <span className="tc-idx">#</span>
        <span className="tc-title">Название</span>
        {showAlbum && <span className="tc-album">Альбом</span>}
        <span className="tc-time">Время</span>
        <span className="tc-like" />
      </div>
      {tracks.map((t, i) => {
        const playing = snap.current?.track.id === t.id && snap.playing
        const paused = snap.current?.track.id === t.id && !snap.playing
        const liked = isLiked(t)
        return (
          <div
            key={t.id + (t.albums?.[0]?.id ?? '')}
            className={'trackrow' + (snap.current?.track.id === t.id ? ' current' : '')}
            onDoubleClick={() => (onPlay ? onPlay(i) : playTracks(tracks, i, playSource))}
            onClick={() => (onPlay ? onPlay(i) : playTracks(tracks, i, playSource))}
            title="Двойной клик — играть"
          >
            <span className="tc-idx">
              {playing ? (
                <IconPause size={16} className="ic-playing" />
              ) : paused ? (
                <IconPlay size={16} className="ic-playing" />
              ) : (
                i + 1
              )}
            </span>
            <span className="tc-title">
              <img
                src={coverUrl(t.coverUri, '80x80') ?? PLACEHOLDER_COVER}
                className="tc-cover"
                alt=""
                onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
              />
              <span className="tc-title-wrap">
                <span className="tc-name">{t.title}</span>
                <span className="tc-artists">{artistNames(t.artists)}</span>
              </span>
            </span>
            {showAlbum && (
              <span className="tc-album">
                <a className="tc-album-link" href={`#/album/${t.albums?.[0]?.id ?? ''}`} onClick={(e) => e.stopPropagation()}>
                  {t.albums?.[0]?.title ?? ''}
                </a>
              </span>
            )}
            <span className="tc-time">{formatMs(t.durationMs ?? 0)}</span>
            <span className="tc-like">
              {showLikes && (
                <button
                  className={'icon-btn small' + (liked ? ' liked' : '')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void toggleLike(t)
                  }}
                  title={liked ? 'Убрать лайк' : 'Лайк'}
                >
                  {liked ? <IconHeartFilled size={16} /> : <IconHeart size={16} />}
                </button>
              )}
              <TrackMenu track={t} index={i} onRemoveFromPlaylist={removeFromPlaylist} />
            </span>
          </div>
        )
      })}
    </div>
  )
}