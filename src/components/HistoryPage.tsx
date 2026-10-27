import { useEffect, useState } from 'react'
import { ymClient } from '../core/client'
import { expandTracks } from '../core/tracks'
import { artistNames, coverUrl, formatMs, PLACEHOLDER_COVER } from '../core/format'
import type { HistoryItem, Track } from '../core/types'
import { playTracks } from './TrackList'
import { IconPlay } from './icons'

interface Row {
  item: HistoryItem
  track: Track | null
  ts: number
}

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ymClient
      .musicHistory()
      .then(async (res) => {
        const raw = (res as { history?: { items?: HistoryItem[] } }).history?.items ?? []
        const trackItems = raw.filter((i) => i.type === 'track' && i.id?.trackId)
        const shorts = trackItems.map((i) => ({ id: i.id!.trackId!, albumId: i.id!.albumId ?? '' }))
        const full = await expandTracks(shorts)
        setRows(
          trackItems.map((item, k) => ({
            item,
            track: full[k] ?? null,
            ts: item.timestamp ? new Date(item.timestamp).getTime() : 0,
          })),
        )
      })
      .catch((e) => setErr('Не удалось загрузить историю: ' + (e as Error).message))
  }, [])

  if (err) return <div className="error-box"><p>{err}</p></div>

  const tracks = rows.map((r) => r.track).filter((t): t is Track => !!t)

  return (
    <div className="entity-page">
      <div className="entity-head">
        <div className="entity-info">
          <div className="entity-type">История</div>
          <h1 className="entity-title">История прослушивания</h1>
          {tracks.length > 0 && (
            <button className="primary-btn" onClick={() => playTracks(tracks, 0)}>
              ▶ Играть всё
            </button>
          )}
        </div>
      </div>
      {rows.length === 0 && <p className="muted pad">История пока пуста</p>}
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
                src={coverUrl(t.coverUri, '64x64') ?? PLACEHOLDER_COVER}
                alt=""
                onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
              />
              <div className="history-meta">
                <div className="history-title">{t.title}</div>
                <div className="history-sub">{artistNames(t.artists)}</div>
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