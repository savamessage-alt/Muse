// Панель «Очередь» — список следующих треков (как в Яндекс Музыке)
import { useEffect, useState } from 'react'
import { player } from '../core/player'
import { artistNames, coverUrl, PLACEHOLDER_COVER } from '../core/format'
import { IconX } from './icons'

export default function QueuePanel({ onClose }: { onClose: () => void }) {
  const [snap, setSnap] = useState(() => player.snapshot())
  const [busy, setBusy] = useState(false)
  useEffect(() => player.onChange(setSnap), [])

  const cur = snap.current
  const items = snap.queue

  const jump = async (i: number) => {
    if (busy) return
    setBusy(true)
    try {
      await player.playIndex(i)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="queue-overlay" onClick={onClose}>
      <div className="queue-panel" onClick={(e) => e.stopPropagation()}>
        <div className="queue-head">
          <span className="queue-title">Очередь · {items.length}</span>
          <button className="icon-btn small" title="Закрыть" onClick={onClose}>
            <IconX size={16} />
          </button>
        </div>
        <div className="queue-list">
          {items.map((it, i) => {
            const isCur = cur && it.track.id === cur.track.id && i === snap.index
            return (
              <div
                key={it.track.id + ':' + (it.track.albums?.[0]?.id ?? '') + ':' + i}
                className={'queue-row' + (isCur ? ' current' : '')}
                onClick={() => void jump(i)}
              >
                <img
                  src={coverUrl(it.track.coverUri, '80x80') ?? PLACEHOLDER_COVER}
                  alt=""
                  onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
                />
                <div className="queue-meta">
                  <div className="queue-name">{it.track.title}</div>
                  <div className="queue-artist">
                    {artistNames(it.track.artists)}
                    {it.source === 'radio' ? ' · радио' : ''}
                  </div>
                </div>
                <button
                  className="icon-btn small queue-remove"
                  title="Убрать из очереди"
                  onClick={(e) => {
                    e.stopPropagation()
                    player.removeIndex(i)
                  }}
                >
                  <IconX size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}