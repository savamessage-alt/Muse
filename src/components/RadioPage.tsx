import { useEffect, useState } from 'react'
import { ymClient } from '../core/client'
import { player } from '../core/player'
import { coverUrl, PLACEHOLDER_COVER } from '../core/format'
import type { RadioStation, Track } from '../core/types'
import { useApp } from '../state/store'
import { IconRadio } from './icons'

export default function RadioPage() {
  const [stations, setStations] = useState<RadioStation[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [currentStation, setCurrentStation] = useState<{ type: string; tag: string; name: string } | null>(null)
  const showToast = useApp((s) => s.showToast)

  useEffect(() => {
    ymClient
      .radioDashboard()
      .then((r) => setStations(r.stations ?? []))
      .catch((e) => setErr('Не удалось загрузить радио: ' + (e as Error).message))
  }, [])

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
    </div>
  )
}