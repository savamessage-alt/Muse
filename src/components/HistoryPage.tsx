import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ymClient } from '../core/client'
import { expandTracks } from '../core/tracks'
import { coverUrl, formatMs, PLACEHOLDER_COVER } from '../core/format'
import { ArtistLink } from './ArtistLink'
import type { HistoryItem, Track } from '../core/types'
import { playTracks } from './TrackList'
import { IconPlay } from './icons'
import { diag } from '../core/diag'
import EmptyState from './EmptyState'
import { IconHistory } from './icons'

interface Row {
  item: HistoryItem
  track: Track | null
  ts: number
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ymClient
      .musicHistory()
      .then(async (itemsRaw) => {
        diag('history: записей=' + itemsRaw.length + ' первая=' + JSON.stringify(itemsRaw[0] ?? {}).slice(0, 120))
        const raw = itemsRaw.filter((i) => i.type === 'track' && i.id?.trackId)
        const shorts = raw.map((i) => ({ id: i.id!.trackId!, albumId: i.id!.albumId ?? '' }))
        const full = await expandTracks(shorts)
        if (alive) {
          setRows(
            raw.map((item, k) => ({
              item,
              track: full[k] ?? null,
              ts: item.timestamp ? new Date(item.timestamp).getTime() : 0,
            })),
          )
        }
      })
      .catch((e) => {
        diag('history: ОШИБКА ' + String((e as Error)?.message ?? e).slice(0, 120))
        if (alive) setErr('Не удалось загрузить историю: ' + (e as Error).message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  if (err) return <div className="error-box"><p>{err}</p></div>

  if (loading) {
    return (
      <div className="entity-page">
        <div className="entity-head">
          <div className="entity-info">
            <div className="entity-type">История</div>
            <h1 className="entity-title">История прослушивания</h1>
          </div>
        </div>
        <div className="list-loading" role="status" aria-label="Загрузка истории">
          <div className="spinner" />
          <span className="muted small">Загружаем…</span>
        </div>
      </div>
    )
  }

  const tracks = rows.map((r) => r.track).filter((t): t is Track => !!t)

  return (
    <div className="entity-page">
      <div className="entity-head">
        <div className="entity-info">
          <div className="entity-type">История</div>
          <h1 className="entity-title">История прослушивания</h1>
          {tracks.length > 0 && (
            <button className="primary-btn" onClick={() => playTracks(tracks, 0)}>
              <IconPlay size={16} /> Играть всё
            </button>
          )}
        </div>
      </div>
      {rows.length === 0 && (
        <EmptyState
          icon={<IconHistory size={48} />}
          title="История пока пуста"
          subtitle="Начните слушать музыку, и здесь появятся прослушанные треки"
          actionLabel="Перейти на радио"
          onAction={() => navigate('/radio')}
        />
      )}
      <div className="history-list">
        {rows.map((r, i) => {
          const t = r.track
          if (!t) return null
          return (
            <div
              key={t.id + i}
              className="history-row"
              onClick={() => playTracks(tracks, i)}
              title="Играть"
            >
              <img
                src={coverUrl(t.coverUri, '80x80') ?? PLACEHOLDER_COVER}
                alt=""
                onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
              />
              <div className="history-meta">
                <div className="history-title">{t.title}</div>
                <ArtistLink artists={t.artists} className="history-sub" />
              </div>
              <span className="history-time">{formatMs(t.durationMs ?? 0)}</span>
              <span className="history-play"><IconPlay size={16} /></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}