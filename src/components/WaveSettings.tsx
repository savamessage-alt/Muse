import { useEffect, useMemo, useState } from 'react'
import {
  buildSeeds,
  DIVERSITY_PRESETS,
  ENERGY_LEVELS,
  GENRE_CATEGORIES,
  LANGUAGE_PRESETS,
  MOOD_PRESETS,
} from '../core/wave'
import { IconX } from './icons'

/** Готовый выбор пользователя — передаётся в плеер для запуска волны */
export interface WaveChoice {
  /** все seed-компоненты (могут пустые или не все) */
  moodSeed?: string
  energySeed?: string
  langSeed?: string | null
  divSeed?: string
  /** выбранная жанровая станция (tag) */
  genre?: string
  /** человекочитаемое название выбора для подписи/тоста */
  label: string
}

interface Props {
  current: WaveChoice
  onApply: (c: WaveChoice) => void
  onClose: () => void
}

/** Панель настроек «Моей волны»: мультивыбор настроения, энергии, языка,
 *  характера и жанра. Все настройки применяются одновременно. */
export default function WaveSettings({ current, onApply, onClose }: Props) {
  const [tab, setTab] = useState<'settings' | 'genre'>('settings')
  const [moodSeed, setMoodSeed] = useState<string | undefined>(current.moodSeed)
  const [energySeed, setEnergySeed] = useState<string | undefined>(current.energySeed)
  const [langSeed, setLangSeed] = useState<string | null | undefined>(current.langSeed)
  const [divSeed, setDivSeed] = useState<string | undefined>(current.divSeed)
  const [genre, setGenre] = useState<string | undefined>(current.genre)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const seedsUsed = useMemo(
    () => buildSeeds(moodSeed, energySeed, langSeed ?? null, divSeed),
    [moodSeed, energySeed, langSeed, divSeed],
  )
  const activeCount = seedsUsed.length + (genre ? 1 : 0)

  const genreName = genre ? GENRE_CATEGORIES.flatMap(c => c.genres).find((g) => g.tag === genre)?.name ?? genre : null

  const applyNow = async () => {
    setApplying(true)
    try {
      const parts: string[] = []
      if (genreName) parts.push(genreName)
      if (activeCount === 0) {
        onApply({ label: 'Моя волна' })
      } else {
        const label = parts.length ? parts.join(' · ') : 'Моя волна'
        onApply({
          moodSeed,
          energySeed,
          langSeed: langSeed ?? null,
          divSeed,
          genre,
          label,
        })
      }
    } finally {
      setApplying(false)
      onClose()
    }
  }

  const clearAll = () => {
    setMoodSeed(undefined)
    setEnergySeed(undefined)
    setLangSeed(undefined)
    setDivSeed(undefined)
    setGenre(undefined)
    setApplying(false)
  }

  // Energy bar click handler - map X position to 1..4
  const handleEnergyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, relX / rect.width))
    const idx = Math.floor(pct * 4) // 0..3
    const level = ENERGY_LEVELS[idx]
    if (level) setEnergySeed(energySeed === level.seed ? undefined : level.seed)
  }

  return (
    <div className="ws-overlay" onClick={onClose}>
      <div className="ws-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Настроить волну">
        <div className="ws-head">
          <span className="ws-title">Настроить волну</span>
          <button className="icon-btn" onClick={onClose} title="Закрыть">
            <IconX size={16} />
          </button>
        </div>

        <div className="ws-tabs">
          <button className={'ws-tab' + (tab === 'settings' ? ' active' : '')} onClick={() => setTab('settings')}>
            Параметры
          </button>
          <button
            className={'ws-tab' + (tab === 'genre' ? ' active' : '')}
            onClick={() => setTab('genre')}
            title="Выбрать жанр"
          >
            Жанры
          </button>
        </div>

        <div className="ws-body">
        {tab === 'settings' ? (
          <>
            <div className="ws-section">
              <div className="ws-section-title">Настроение</div>
              <div className="ws-grid ws-grid--mood">
                {MOOD_PRESETS.map((m) => (
                  <button
                    key={m.value}
                    className={'ws-tile' + (moodSeed === m.seed ? ' active' : '')}
                    onClick={() => setMoodSeed(moodSeed === m.seed ? undefined : m.seed)}
                    title="Выбрать / снять"
                  >
                    <span className="ws-tile-icon">{m.icon}</span>
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
              {moodSeed && (
                <button className="ws-clear" onClick={() => setMoodSeed(undefined)}>
                  снять настроение
                </button>
              )}
            </div>

            <div className="ws-section">
              <div className="ws-section-title">По характеру</div>
              <div className="ws-chips">
                {DIVERSITY_PRESETS.map((d) => (
                  <button
                    key={d.value}
                    className={'ws-chip' + (divSeed === d.seed ? ' active' : '')}
                    onClick={() => setDivSeed(divSeed === d.seed ? undefined : d.seed)}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="ws-section">
              <div className="ws-section-title">Энергия</div>
              <div className="ws-energy-bar" onClick={handleEnergyClick} role="slider" aria-label="Энергия" tabIndex={0}>
                <div className="ws-energy-fill" style={{ width: energySeed ? `${(ENERGY_LEVELS.findIndex(l => l.seed === energySeed) + 1) * 25}%` : '0%' }} />
                {ENERGY_LEVELS.map((e, i) => (
                  <span key={e.value} className={'ws-energy-mark' + (energySeed === e.seed ? ' active' : '')} style={{ left: `${i * 25 + 12.5}%` }}>
                    <span className="ws-energy-dot" />
                  </span>
                ))}
                <div className="ws-energy-labels">
                  <span>Ниже</span>
                  <span>Выше</span>
                </div>
              </div>
            </div>

            <div className="ws-section ws-section--lang">
              <div className="ws-section-title">Язык</div>
              <div className="ws-chips">
                {LANGUAGE_PRESETS.map((l) => (
                  <button
                    key={l.value}
                    className={'ws-chip' + (langSeed === l.seed ? ' active' : '')}
                    onClick={() => setLangSeed(langSeed === l.seed ? undefined : l.seed)}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="ws-section">
            <div className="ws-section-title">Жанр волны</div>
            {GENRE_CATEGORIES.map((cat) => (
              <div key={cat.id} className="ws-genre-category">
                <div className="ws-genre-cat-title">{cat.name}</div>
                <div className="ws-chips ws-chips--genres">
                  {cat.genres.map((g) => (
                    <button
                      key={g.tag}
                      className={'ws-chip ws-chip--genre' + (genre === g.tag ? ' active' : '')}
                      onClick={() => setGenre(genre === g.tag ? undefined : g.tag)}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="ws-hint">Жанр комбинируется с настроением, энергией, языком и характером.</p>
          </div>
        )}
        </div>

        <div className="ws-footer">
          <button className="ws-clear ws-clear--all" onClick={clearAll} title="Сбросить все настройки">
            Сбросить
          </button>
          <button className="primary-btn ws-apply" onClick={applyNow}>
            {activeCount ? 'Применить и включить' : 'Включить волну'}
          </button>
        </div>
      </div>
    </div>
  )
}