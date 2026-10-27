import { useEffect, useState } from 'react'
import { ymClient } from '../core/client'
import { player } from '../core/player'
import { coverUrl, PLACEHOLDER_COVER } from '../core/format'
import type { RadioStation, Track } from '../core/types'
import { useApp } from '../state/store'
import { IconRadio } from './icons'
import { Section } from './cards'

interface Premiere {
  kind: number
  ownerUid: number
  title: string
  cover?: string
  trackCount?: number
  description?: string
}

export default function RadioPage() {
  const [stations, setStations] = useState<RadioStation[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [currentStation, setCurrentStation] = useState<{ type: string; tag: string; name: string } | null>(null)
  const showToast = useApp((s) => s.showToast)
  const [premieres, setPremieres] = useState<Premiere[]>([])
  const [loadingPl, setLoadingPl] = useState<number | null>(null)

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
    </div>
  )
}