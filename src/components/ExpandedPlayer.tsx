import { useEffect, useRef, useState } from 'react'
import { player, type PlayerSnapshot } from '../core/player'
import { useApp } from '../state/store'
import { coverUrl, formatMs, PLACEHOLDER_COVER, trackKey } from '../core/format'
import { ArtistLink } from './ArtistLink'
import DropdownMenu from './DropdownMenu'
import { SPEEDS } from './SpeedMenu'
import {
  IconPlay,
  IconPause,
  IconPrev,
  IconNext,
  IconShuffle,
  IconRepeat,
  IconHeart,
  IconHeartFilled,
  IconVolume,
  IconX,
  IconLyrics,
  IconSimilar,
  IconQueue,
  IconMoon,
  IconSleepTimer,
  IconMore,
  IconCheck,
  IconDislike,
} from './icons'

function formatRemaining(ms: number | null): string {
  if (ms === null) return ''
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function useSnapshot(): PlayerSnapshot {
  const [snap, setSnap] = useState<PlayerSnapshot>(() => player.snapshot())
  useEffect(() => {
    const unsub = player.onChange(setSnap)
    return () => unsub()
  }, [])
  return snap
}

interface Props {
  onClose: () => void
  onLyrics: () => void
  onQueue: () => void
  onSimilar: () => void
  onSleepTimer: () => void
}

/** Полноэкранный плеер «bottom-sheet»: крупная обложка, управление, быстрый доступ ко всем панелям */
export default function ExpandedPlayer({ onClose, onLyrics, onQueue, onSimilar, onSleepTimer }: Props) {
  const snap = useSnapshot()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const repeatLabel = snap.repeat === 'off' ? 'выкл' : snap.repeat === 'all' ? 'все' : 'один'
  const sleepLabel =
    snap.sleepTimer.mode === 'off'
      ? 'выкл'
      : snap.sleepTimer.mode === 'track-end'
        ? 'после трека'
        : `${Math.max(0, Math.round((snap.sleepRemainingMs ?? 0) / 60000))} мин`
  const likedKeys = useApp((s) => s.likedKeys)
  const toggleLike = useApp((s) => s.toggleLike)
  const cur = snap.current
  const liked = cur ? likedKeys.has(trackKey(cur.track)) : false
  const duration = snap.durationMs || 0
  const position = snap.positionMs

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Свайпы по обложке: влево — следующий, вправо — предыдущий, вниз — свернуть
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const coverPointer = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      swipeRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    },
    onPointerMove: (e: React.PointerEvent) => {
      // лёгкий визуальный сдвиг обложки при свайпе
      const s = swipeRef.current
      if (!s) return
      const dx = e.clientX - s.x
      const el = e.currentTarget as HTMLElement
      el.style.transform = dx !== 0 ? `translateX(${Math.max(-90, Math.min(90, dx * 0.35))}px)` : ''
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = swipeRef.current
      swipeRef.current = null
      const el = e.currentTarget as HTMLElement
      el.style.transform = ''
      if (!s) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Date.now() - s.t > 800) return
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        void (dx < 0 ? player.next() : player.prev())
      } else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        onClose()
      }
    },
  }

  return (
    <div className="psheet" onClick={onClose}>
      <div className="psheet-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Плеер">
        <div className="psheet-head">
          <span className="muted small">Сейчас играет</span>
          <div className="psheet-head-actions">
            <button
              className={'panel-close' + (snap.sleepTimer.mode !== 'off' ? ' has-timer' : '')}
              onClick={onSleepTimer}
              title="Таймер сна"
              aria-label="Таймер сна"
            >
              <IconSleepTimer size={17} />
            </button>
            <button className="panel-close" onClick={onClose} title="Свернуть" aria-label="Свернуть плеер">
              <IconX size={17} />
            </button>
          </div>
        </div>

        {cur ? (
          <div className="psheet-main">
            <div
              className="psheet-cover-wrap"
              {...coverPointer}
              title="Свайп влево/вправо — следующий/предыдущий, вниз — свернуть"
            >
              <img
                className="psheet-cover"
                src={coverUrl(cur.track.coverUri, '400x400') ?? PLACEHOLDER_COVER}
                alt=""
                draggable={false}
                onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
              />
              <span className="psheet-swipe-hint muted small">← свайп →</span>
            </div>
            <div className="psheet-side">
              <div className="psheet-title">
                {snap.playing && cur && <span className="eq psheet-eq" aria-hidden="true"><span /><span /><span /><span /></span>}
                {cur.track.title}
              </div>
              <ArtistLink artists={cur.track.artists} className="psheet-artist" />
              <div className="psheet-controls">
                <button
                  className={'icon-btn' + (snap.shuffle ? ' active' : '')}
                  onClick={() => player.setShuffle(!snap.shuffle)}
                  title="Перемешать"
                >
                  <IconShuffle size={20} />
                </button>
                <button className="icon-btn" onClick={() => void player.prev()} title="Предыдущий">
                  <IconPrev size={24} />
                </button>
                <button className="psheet-play" onClick={() => void player.toggle()} title={snap.playing ? 'Пауза' : 'Играть'}>
                  {snap.playing ? <IconPause size={26} /> : <IconPlay size={26} />}
                </button>
                <button className="icon-btn" onClick={() => void player.next()} title="Следующий">
                  <IconNext size={24} />
                </button>
                <button
                  className={'icon-btn' + (snap.repeat !== 'off' ? ' active' : '')}
                  onClick={() => player.setRepeat(snap.repeat === 'off' ? 'all' : snap.repeat === 'all' ? 'one' : 'off')}
                  title="Повтор: off / все / один"
                >
                  <IconRepeat size={20} />
                </button>
              </div>
              <div className="psheet-seek">
                <span className="pb-time">{formatMs(position)}</span>
                <input
                  type="range"
                  className="range"
                  min={0}
                  max={Math.max(duration, 1)}
                  value={Math.min(position, Math.max(duration, 1))}
                  onChange={(e) => player.seek(Number(e.target.value))}
                  aria-label="Перемотка"
                />
                <span className="pb-time">{formatMs(duration)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="psheet-empty muted">Очередь пуста — выберите трек</div>
        )}

        <div className="psheet-foot">
          <button
            className={'icon-btn' + (liked ? ' liked' : '')}
            onClick={() => cur && void toggleLike(cur.track)}
            title={liked ? 'Убрать из «Избранное»' : 'В «Избранное»'}
          >
            {liked ? <IconHeartFilled size={20} /> : <IconHeart size={20} />}
          </button>
          <button
            className="icon-btn"
            onClick={(e) => {
              setMenuAnchor(e.currentTarget)
              setMenuOpen((v) => !v)
            }}
            title="Все функции"
            aria-label="Все функции плеера"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <IconMore size={20} />
          </button>
          <div className="psheet-vol">
            <IconVolume size={18} className="pb-vol-icon" />
            <input
              type="range"
              className="range thin"
              min={0}
              max={1}
              step={0.01}
              value={snap.muted ? 0 : snap.volume}
              onChange={(e) => player.setVolume(Number(e.target.value))}
              aria-label="Громкость"
            />
          </div>
        </div>

        <DropdownMenu open={menuOpen} anchor={menuAnchor} onClose={() => setMenuOpen(false)} minWidth={280} className="pb-menu">
          <div className="dropdown-title">Скорость</div>
          <div className="speed-chips">
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={'speed-chip' + (snap.playbackRate === s ? ' active' : '')}
                onClick={() => player.setPlaybackRate(s)}
                aria-pressed={snap.playbackRate === s}
              >
                {s}×
              </button>
            ))}
          </div>

          <div className="dropdown-sep" />

          <button className="dropdown-item" onClick={() => player.setShuffle(!snap.shuffle)}>
            <IconShuffle size={16} />
            <span className="dropdown-item-name">Перемешать</span>
            {snap.shuffle && <IconCheck size={15} />}
          </button>
          <button
            className="dropdown-item"
            onClick={() => player.setRepeat(snap.repeat === 'off' ? 'all' : snap.repeat === 'all' ? 'one' : 'off')}
          >
            <IconRepeat size={16} />
            <span className="dropdown-item-name">Повтор</span>
            <span className="dropdown-count">{repeatLabel}</span>
          </button>

          <div className="dropdown-sep" />

          {snap.isRadio && (
            <>
              <button
                className="dropdown-item"
                onClick={() => {
                  player.likeCurrentRadio()
                  setMenuOpen(false)
                }}
              >
                <IconHeart size={16} />
                <span className="dropdown-item-name">Нравится</span>
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  void player.dislikeCurrent()
                  setMenuOpen(false)
                }}
              >
                <IconDislike size={16} />
                <span className="dropdown-item-name">Не нравится</span>
              </button>
              <div className="dropdown-sep" />
            </>
          )}

          <button
            className="dropdown-item"
            onClick={() => {
              onLyrics()
              setMenuOpen(false)
            }}
          >
            <IconLyrics size={16} />
            <span className="dropdown-item-name">Текст песни</span>
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              onSimilar()
              setMenuOpen(false)
            }}
          >
            <IconSimilar size={16} />
            <span className="dropdown-item-name">Похожие треки</span>
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              onQueue()
              setMenuOpen(false)
            }}
          >
            <IconQueue size={16} />
            <span className="dropdown-item-name">Очередь</span>
            <span className="dropdown-count">{snap.queue.length}</span>
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              onSleepTimer()
              setMenuOpen(false)
            }}
          >
            <IconSleepTimer size={16} />
            <span className="dropdown-item-name">Таймер сна</span>
            {snap.sleepTimer.mode !== 'off' && <span className="dropdown-count">{sleepLabel}</span>}
          </button>
        </DropdownMenu>
      </div>
    </div>
  )
}