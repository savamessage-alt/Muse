import { useEffect, useRef, useState } from 'react'
import { player, type PlayerSnapshot } from '../core/player'
import { useApp } from '../state/store'
import { coverUrl, formatMs, PLACEHOLDER_COVER, artistNames, trackKey } from '../core/format'
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
} from './icons'

function useSnapshot(): PlayerSnapshot {
  const [snap, setSnap] = useState<PlayerSnapshot>(() => player.snapshot())
  useEffect(() => player.onChange(setSnap), [])
  return snap
}

interface Props {
  onClose: () => void
  onLyrics: () => void
  onQueue: () => void
  onSimilar: () => void
}

/** Полноэкранный плеер «bottom-sheet»: крупная обложка, управление, быстрый доступ ко всем панелям */
export default function ExpandedPlayer({ onClose, onLyrics, onQueue, onSimilar }: Props) {
  const snap = useSnapshot()
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
          <button className="icon-btn" onClick={onClose} title="Свернуть">
            <IconX size={18} />
          </button>
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
              <div className="psheet-artist" title={artistNames(cur.track.artists)}>
                {artistNames(cur.track.artists)}
              </div>
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
          <button className={'icon-btn' + ''} onClick={onLyrics} title="Текст песни" disabled={!cur}>
            <IconLyrics size={19} />
          </button>
          <button className="icon-btn" onClick={onSimilar} title="Похожие треки" disabled={!cur}>
            <IconSimilar size={20} />
          </button>
          <button className="icon-btn" onClick={onQueue} title="Очередь">
            <IconQueue size={20} />
            {snap.queue.length > 0 && <span className="queue-badge">{snap.queue.length}</span>}
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
      </div>
    </div>
  )
}