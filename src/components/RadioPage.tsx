import { useEffect, useState } from 'react'
import { ymClient } from '../core/client'
import { player } from '../core/player'
import { coverUrl, PLACEHOLDER_COVER } from '../core/format'
import type { RadioStation, Track, TrackShort } from '../core/types'
import { useApp } from '../state/store'
import { IconRadio } from './icons'
import { Section } from './cards'
import TrackList, { playTracks } from './TrackList'
import { expandTracks } from '../core/tracks'

interface Premiere {
  kind: number
  ownerUid: number
  title: string
  cover?: string
  trackCount?: number
  description?: string
}

interface Collection {
  kind: number
  ownerUid: number
  title: string
  cover?: string
  trackCount?: number
}

export default function RadioPage() {
  const [stations, setStations] = useState<RadioStation[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [currentStation, setCurrentStation] = useState<{ type: string; tag: string; name: string } | null>(null)
  const showToast = useApp((s) => s.showToast)
  const [premieres, setPremieres] = useState<Premiere[]>([])
  const [loadingPl, setLoadingPl] = useState<number | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [chart, setChart] = useState<{ title?: string; tracks: Track[]; plays: Map<string, number> } | null>(null)
  const [chartBusy, setChartBusy] = useState(false)

  useEffect(() => {
    ymClient
      .radioDashboard()
      .then((r) => setStations(r.stations ?? []))
      .catch((e) => setErr('Не удалось загрузить радио: ' + (e as Error).message))

    // «Новинки и Премьеры» из ленты — готовые плейлисты с треками
    ymClient
      .feed()
      .then((f) => {
        const pls: Premiere[] = []
        for (const g of f.generatedPlaylists ?? []) {
          if (g.data?.kind !== undefined && g.data?.owner?.uid !== undefined) {
            pls.push({
              kind: g.data.kind,
              ownerUid: g.data.owner.uid,
              title: g.data.title ?? 'Плейлист',
              cover: g.data.cover?.uri ?? g.data.ogImage,
              trackCount: g.data.trackCount,
              description: g.data.description,
            })
          }
        }
        setPremieres(pls)
      })
      .catch(() => {
        /* лента недоступна — не показываем премьеры */
      })

    // «Подборки для вас» (новые плейлисты из лендинга)
    ymClient
      .landing(['new-playlists'])
      .then((blocks) => {
        const out: Collection[] = []
        for (const b of blocks ?? []) {
          for (const e of b.entities ?? []) {
            const d = e.data
            const pl = d?.playlist ?? d
            if (pl?.kind !== undefined) {
              out.push({
                kind: pl.kind,
                ownerUid: pl.owner?.uid ?? 0,
                title: pl.title ?? 'Подборка',
                cover: pl.cover?.uri ?? undefined,
                trackCount: pl.trackCount,
              })
            }
          }
        }
        setCollections(out.filter((x) => x.ownerUid > 0))
      })
      .catch(() => {
        /* без интернета — просто нет подборок */
      })

    // «Чарт: Топ-100»
    void (async () => {
      try {
        const res = await ymClient.chart()
        const pl = res?.chart
        if (pl && Array.isArray(pl.tracks)) {
          const shorts: TrackShort[] = pl.tracks.map((x) => x.track).filter((x): x is TrackShort => !!x)
          const plays = new Map<string, number>()
          for (const x of pl.tracks) if (x.track?.id && x.playCount) plays.set(x.track.id, x.playCount)
          const full = await expandTracks(shorts)
          setChart({ title: pl.title ?? 'Чарт', tracks: full, plays })
        }
      } catch {
        /* чарт недоступен — не показываем */
      }
    })()
  }, [])

  const playPremiere = async (p: Premiere) => {
    setLoadingPl(p.kind)
    try {
      const tracks = await ymClient.playlistTracks(p.ownerUid, p.kind)
      if (tracks.length) void player.playQueue(tracks.map((t) => ({ track: t, source: 'playlist' })), 0)
    } finally {
      setLoadingPl(null)
    }
  }

  const playCollection = async (x: Collection) => {
    setLoadingPl(x.kind)
    try {
      const tracks = await ymClient.playlistTracks(x.ownerUid, x.kind)
      if (tracks.length) await player.playQueue(tracks.map((t) => ({ track: t, source: 'playlist' })), 0)
    } finally {
      setLoadingPl(null)
    }
  }

  const playChart = async () => {
    if (!chart?.tracks.length) return
    setChartBusy(true)
    try {
      await player.playQueue(chart.tracks.map((t) => ({ track: t, source: 'queue' })), 0)
      showToast('🎵 Чарт — играет')
    } catch (e) {
      showToast('Ошибка чарта: ' + (e as Error).message, 'error')
    } finally {
      setChartBusy(false)
    }
  }

  const playStation = async (s: RadioStation) => {
    const type = s.station?.id?.type ?? s.id?.type ?? ''
    const tag = s.station?.id?.tag ?? s.id?.tag ?? ''
    const name = s.station?.name ?? 'Станция'
    if (!type || !tag) return
    setBusy(true)
    try {
      const res = await ymClient.radioStationTracks(type, tag)
      const tracks = (res.sequence ?? [])
        .filter((x) => x.type === 'track' && x.track)
        .map((x) => x.track as Track)
      if (!tracks.length) {
        showToast('Станция не вернула треки (возможно, нужна подписка)', 'error')
        return
      }
      await player.playQueue(
        tracks.map((track) => ({ track, source: 'radio' as const })),
        0,
        { type, tag },
      )
      setCurrentStation({ type, tag, name })
      showToast('Радио: ' + name)
    } catch (e) {
      showToast('Ошибка радио: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Радио</h1>
        {currentStation && <span className="now-station">Сейчас: {currentStation.name}</span>}
      </div>
      {err && <div className="error-box"><p>{err}</p></div>}
      {busy && <div className="spinner" />}

      {stations.length === 0 && !err && !busy && (
        <p className="muted pad">Станции не найдены. Возможно, нужен аккаунт с подпиской Яндекс Плюс.</p>
      )}

      <div className="radio-grid">
        {stations.map((s, i) => {
          const name = s.station?.name ?? 'Станция'
          const iconUri = s.station?.icon?.uri
          return (
            <button key={name + i} className="radio-card" onClick={() => void playStation(s)}>
              <div className="card-cover">
                {iconUri ? (
                  <img
                    src={coverUrl(iconUri, '200x200') ?? PLACEHOLDER_COVER}
                    alt=""
                    onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
                  />
                ) : (
                  <div className="radio-fallback"><IconRadio size={48} /></div>
                )}
                <div className="card-play">▶</div>
              </div>
              <div className="card-title">{name}</div>
            </button>
          )
        })}
      </div>

      {collections.length > 0 && (
        <Section title="Подборки для вас">
          <div className="radio-grid">
            {collections.map((x) => (
              <button key={x.kind + '-' + x.ownerUid} className="radio-card" onClick={() => void playCollection(x)} disabled={loadingPl === x.kind}>
                <div className="card-cover">
                  <img
                    src={coverUrl(x.cover) ?? PLACEHOLDER_COVER}
                    alt=""
                    onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
                  />
                  <div className="card-play">{loadingPl === x.kind ? '…' : '▶'}</div>
                </div>
                <div className="card-title">{x.title ?? 'Подборка'}</div>
              </button>
            ))}
          </div>
        </Section>
      )}

      {premieres.length > 0 && (
        <Section title="Новинки и Премьеры">
          <div className="premieres">
            {premieres.map((p) => (
              <button
                key={p.kind}
                className="premiere-card"
                onClick={() => void playPremiere(p)}
                disabled={loadingPl === p.kind}
              >
                <img
                  src={coverUrl(p.cover) ?? PLACEHOLDER_COVER}
                  alt=""
                  className="premiere-cover"
                  onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
                />
                <span className="premiere-info">
                  <span className="premiere-title">{p.title ?? 'Плейлист'}</span>
                  <span className="muted small">
                    {p.trackCount ? `${p.trackCount} треков` : ''} · нажмите, чтобы слушать
                  </span>
                </span>
                <span className="premiere-play">{loadingPl === p.kind ? '…' : '▶ Слушать'}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {chart && chart.tracks.length > 0 && (
        <Section title={chart.title ?? 'Чарт'}>
          <button className="primary-btn small" onClick={() => void playChart()} disabled={chartBusy}>
            {chartBusy ? '…' : '▶ Играть всё'}
          </button>
          <TrackList
            tracks={chart.tracks.slice(0, 50)}
            emptyText="Треков нет"
            playSource="queue"
          />
        </Section>
      )}
    </div>
  )
}
