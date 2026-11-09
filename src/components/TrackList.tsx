import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { player, type PlayableTrack } from '../core/player'
import { useApp } from '../state/store'
import { artistNames, coverUrl, formatMs, trackKey, PLACEHOLDER_COVER } from '../core/format'
import type { Track } from '../core/types'
import { IconPlay, IconHeart, IconHeartFilled, IconMore, IconList, IconPlus, IconTrash } from './icons'

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
  openSignal,
}: {
  track: Track
  index?: number
  onRemoveFromPlaylist?: (index: number) => void
  /** внешний сигнал открыть меню (свайп влево по строке) */
  openSignal?: number
}) {
  const playlists = useApp((s) => s.playlists)
  const addToPlaylist = useApp((s) => s.addToPlaylist)
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openSignal && openSignal > 0) setOpen(true)
  }, [openSignal])

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

/** Время последнего свайпа по строке — чтобы не срабатывал клик «играть» */
let lastRowSwipeAt = 0

export default function TrackList({ tracks, onPlay, showAlbum = true, showLikes = true, emptyText, playSource = 'queue', loading, removeFromPlaylist }: Props) {
  const [snap, setSnap] = useState(() => player.snapshot())
  useEffect(() => player.onChange(setSnap), [])
  const likedKeys = useApp((s) => s.likedKeys)
  const toggleLike = useApp((s) => s.toggleLike)
  const rowSwipe = useRef<{ x: number; y: number; t: number } | null>(null)
  const [menuSignal, setMenuSignal] = useState<{ id: string; n: number } | null>(null)

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
        const liked = likedKeys.has(trackKey(t))
        return (
          <div
            key={t.id + (t.albums?.[0]?.id ?? '')}
            className={'trackrow' + (snap.current?.track.id === t.id ? ' current' : '')}
            onDoubleClick={() => (onPlay ? onPlay(i) : playTracks(tracks, i, playSource))}
            onClick={() => {
              if (Date.now() - lastRowSwipeAt < 400) return
              if (onPlay) onPlay(i)
              else playTracks(tracks, i, playSource)
            }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('.icon-btn')) return
              rowSwipe.current = { x: e.clientX, y: e.clientY, t: Date.now() }
            }}
            onPointerUp={(e) => {
              const s = rowSwipe.current
              rowSwipe.current = null
              if (!s) return
              const dx = e.clientX - s.x
              const dy = e.clientY - s.y
              if (Date.now() - s.t > 700) return
              if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
              lastRowSwipeAt = Date.now()
              if (dx < 0) setMenuSignal({ id: t.id, n: Date.now() })
              else void toggleLike(t)
            }}
            title="Двойной клик — играть · свайп влево — действия, вправо — лайк"
          >
            <span className="tc-idx">
              {playing ? (
                <span className="eq ic-playing" title="Сейчас играет" aria-label="Сейчас играет">
                  <span /><span /><span /><span />
                </span>
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
              <TrackMenu
                track={t}
                index={i}
                onRemoveFromPlaylist={removeFromPlaylist}
                openSignal={menuSignal?.id === t.id ? menuSignal.n : 0}
              />
            </span>
          </div>
        )
      })}
    </div>
  )
}