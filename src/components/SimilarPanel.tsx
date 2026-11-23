// Панель «Похожие треки» — как в Яндекс Музыке: похожее на текущий трек
import { useEffect, useState } from 'react'
import { ymClient } from '../core/client'
import { player } from '../core/player'
import { coverUrl, PLACEHOLDER_COVER } from '../core/format'
import { ArtistLink } from './ArtistLink'
import type { Track } from '../core/types'
import { IconPlay, IconX } from './icons'

export default function SimilarPanel({ trackTitle, onClose }: { trackTitle: string; onClose: () => void }) {
  const [snap, setSnap] = useState(() => player.snapshot())
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => player.onChange(setSnap), [])

  const cur = snap.current

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    ymClient
      .tracksSimilar(cur?.track.id ?? '')
      .then((res) => {
        if (!alive) return
        setTracks(res.similarTracks ?? [])
        setLoading(false)
      })
      .catch((e) => {
        if (!alive) return
        setError('Не удалось загрузить похожие: ' + (e instanceof Error ? e.message : String(e)))
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [cur?.track.id])

  const playAll = async () => {
    if (!tracks.length || busy) return
    setBusy(true)
    try {
      await player.playQueue(tracks.map((t) => ({ track: t, source: 'queue' })), 0)
    } finally {
      setBusy(false)
    }
  }

  const playAt = async (i: number) => {
    if (busy) return
    setBusy(true)
    try {
      await player.playQueue(tracks.map((t) => ({ track: t, source: 'queue' })), i)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="queue-overlay" onClick={onClose}>
      <div className="queue-panel" onClick={(e) => e.stopPropagation()}>
        <div className="queue-head">
          <span className="queue-title">
            Похожие · {trackTitle || 'трек'}
            {tracks.length ? ` · ${tracks.length}` : ''}
          </span>
          <span className="queue-actions">
            <button className="btn small" onClick={() => void playAll()} disabled={!tracks.length || busy}>
              <IconPlay size={14} /> Играть всё
            </button>
            <button className="icon-btn small" title="Закрыть" aria-label="Закрыть похожие треки" onClick={onClose}>
              <IconX size={16} />
            </button>
          </span>
        </div>
        <div className="queue-list">
          {loading && <div className="muted pad">Загружаем похожие треки…</div>}
          {!loading && error && <div className="muted pad">{error}</div>}
          {!loading && !error && tracks.length === 0 && <div className="muted pad">Похожих треков нет</div>}
          {tracks.map((t, i) => {
            const isCur = cur && t.id === cur.track.id
            return (
              <div
                key={t.id + ':' + (t.albums?.[0]?.id ?? '')}
                className={'queue-row' + (isCur ? ' current' : '')}
                onClick={() => void playAt(i)}
              >
                <img
                  src={coverUrl(t.coverUri, '80x80') ?? PLACEHOLDER_COVER}
                  alt=""
                  onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
                />
                <div className="queue-meta">
                  <div className="queue-name">{t.title}</div>
                  <ArtistLink artists={t.artists} className="queue-artist" />
                </div>
                <IconPlay size={16} className="queue-play" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}