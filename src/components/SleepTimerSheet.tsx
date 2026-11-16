import { useEffect, useState } from 'react'
import { player, type PlayerSnapshot } from '../core/player'
import { IconX, IconMoon } from './icons'

function formatRemaining(ms: number | null): string {
  if (ms === null) return ''
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const PRESETS = [15, 30, 45, 60]

interface Props {
  snap: PlayerSnapshot
  onClose: () => void
}

/** Шторка «Таймер сна»: пресеты, «до конца трека» и кастомное время */
export default function SleepTimerSheet({ snap, onClose }: Props) {
  const timer = snap.sleepTimer
  const active = timer.mode !== 'off'
  const [custom, setCustom] = useState(false)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(90)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const applyCustom = () => {
    const total = hours * 60 + minutes
    if (total <= 0) return
    player.setSleepTimerMinutes(total)
    onClose()
  }

  return (
    <div className="st-overlay" onClick={onClose}>
      <div className="st-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Таймер сна">
        <div className="st-head">
          <span className="st-title">
            <IconMoon size={18} /> Таймер сна
          </span>
          <button className="icon-btn" onClick={onClose} title="Закрыть">
            <IconX size={16} />
          </button>
        </div>

        {active && (
          <div className="st-active">
            <div className="st-active-text">
              {timer.mode === 'track-end' ? (
                <>Остановка после текущего трека</>
              ) : (
                <>
                  Осталось <b>{formatRemaining(snap.sleepRemainingMs)}</b>
                </>
              )}
            </div>
            <div className="st-active-actions">
              {timer.mode === 'time' && (
                <>
                  <button className="st-chip" onClick={() => player.extendSleepTimer(5)}>
                    +5 мин
                  </button>
                  <button className="st-chip" onClick={() => player.extendSleepTimer(10)}>
                    +10 мин
                  </button>
                </>
              )}
              <button className="st-chip st-chip--danger" onClick={() => player.cancelSleepTimer()}>
                Отключить
              </button>
            </div>
          </div>
        )}

        <div className="st-label">Остановить через</div>
        <div className="st-presets">
          {PRESETS.map((m) => (
            <button
              key={m}
              className={
                'st-preset' +
                (timer.mode === 'time' && timer.totalMs === m * 60_000 ? ' active' : '')
              }
              onClick={() => {
                player.setSleepTimerMinutes(m)
                onClose()
              }}
            >
              {m} мин
            </button>
          ))}
        </div>

        <button
          className={'st-row' + (timer.mode === 'track-end' ? ' active' : '')}
          onClick={() => {
            player.setSleepTimerTrackEnd()
            onClose()
          }}
        >
          До конца трека
        </button>

        <button className={'st-row' + (custom ? ' active' : '')} onClick={() => setCustom((v) => !v)}>
          Своё время…
        </button>

        {custom && (
          <div className="st-custom">
            <div className="st-custom-fields">
              <label className="st-field">
                <span>Часы</span>
                <input
                  className="input st-input"
                  type="number"
                  min={0}
                  max={12}
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
                />
              </label>
              <label className="st-field">
                <span>Минуты</span>
                <input
                  className="input st-input"
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                />
              </label>
            </div>
            <div className="st-quick">
              {[5, 10, 20, 90].map((m) => (
                <button
                  key={m}
                  className="st-chip"
                  onClick={() => {
                    setHours(Math.floor(m / 60))
                    setMinutes(m % 60)
                  }}
                >
                  {m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч${m % 60 ? ' ' + (m % 60) + ' мин' : ''}`}
                </button>
              ))}
            </div>
            <button className="primary-btn st-apply" onClick={applyCustom} disabled={hours * 60 + minutes <= 0}>
              Запустить таймер
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
