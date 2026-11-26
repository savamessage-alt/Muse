// Панель «Очередь» — список следующих треков.
// Действия с треком — через портальное выпадающее меню (не обрезается списком).
import { useEffect, useState } from 'react'
import { player } from '../core/player'
import { coverUrl, PLACEHOLDER_COVER } from '../core/format'
import { ArtistLink } from './ArtistLink'
import DropdownMenu from './DropdownMenu'
import { IconX, IconMore, IconTrash, IconPlay } from './icons'

export default function QueuePanel({ onClose }: { onClose: () => void }) {
  const [snap, setSnap] = useState(() => player.snapshot())
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState<{ idx: number; el: HTMLElement } | null>(null)
  useEffect(() => player.onChange(setSnap), [])

  const cur = snap.current
  const items = snap.queue
  const active = menu && menu.idx >= 0 && menu.idx < items.length ? items[menu.idx] : null

  const jump = async (i: number) => {
    if (busy) return
    setBusy(true)
    try {
      await player.playIndex(i)
    } finally {
      setBusy(false)
    }
  }

  const remove = (i: number) => {
    setMenu(null)
    player.removeIndex(i)
  }

  return (
    <div className="queue-overlay" onClick={onClose}>
      <div className="queue-panel" onClick={(e) => e.stopPropagation()}>
        <div className="queue-head">
          <span className="queue-title">Очередь · {items.length}</span>
          <button className="panel-close" title="Закрыть" aria-label="Закрыть очередь" onClick={onClose}>
            <IconX size={16} />
          </button>
        </div>
        <div className="queue-list">
          {items.length === 0 && <div className="muted pad">Очередь пуста — выберите трек</div>}
          {items.map((it, i) => {
            const isCur = cur && it.track.id === cur.track.id && i === snap.index
            return (
              <div
                key={it.track.id + ':' + (it.track.albums?.[0]?.id ?? '') + ':' + i}
                className={'queue-row' + (isCur ? ' current' : '') + (menu?.idx === i ? ' menu-open' : '')}
                role="button"
                tabIndex={0}
                aria-label={it.track.title + ' · ' + (it.track.artists?.map((a) => a.name).join(', ') ?? '—')}
                aria-current={isCur ? true : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    void jump(i)
                  }
                }}
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
                    <ArtistLink artists={it.track.artists} />
                    {it.source === 'radio' ? ' · радио' : ''}
                  </div>
                </div>
                <button
                  className={'icon-btn small queue-more' + (menu?.idx === i ? ' active' : '')}
                  title="Действия с треком"
                  aria-label={`Действия: ${it.track.title}`}
                  aria-haspopup="menu"
                  aria-expanded={menu?.idx === i}
                  onClick={(e) => {
                    e.stopPropagation()
                    const el = e.currentTarget
                    setMenu((m) => (m?.idx === i ? null : { idx: i, el }))
                  }}
                >
                  <IconMore size={16} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <DropdownMenu
        open={!!menu}
        anchor={menu?.el ?? null}
        onClose={() => setMenu(null)}
        minWidth={200}
        className="dropdown-up"
      >
        {active && (
          <>
            <div className="dropdown-label" title={active.track.title}>
              {active.track.title}
            </div>
            <button
              className="dropdown-item"
              role="menuitem"
              onClick={() => {
                if (menu) void jump(menu.idx)
                setMenu(null)
              }}
            >
              <IconPlay size={15} /> Играть сейчас
            </button>
            <div className="dropdown-sep" />
            <button
              className="dropdown-item danger"
              role="menuitem"
              onClick={() => menu && remove(menu.idx)}
            >
              <IconTrash size={15} /> Убрать из очереди
            </button>
          </>
        )}
      </DropdownMenu>
    </div>
  )
}
