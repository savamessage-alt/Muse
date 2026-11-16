import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ymClient } from '../core/client'
import { useApp } from '../state/store'
import { player } from '../core/player'
import { coverUrl, formatMs, trackKey, PLACEHOLDER_COVER } from '../core/format'
import { ArtistLink } from './ArtistLink'
import WaveSettings, { type WaveChoice } from './WaveSettings'
import { buildSeeds, findWaveStation, fetchWaveTracks, fetchGenreTracks, GENRES, WAVE } from '../core/wave'
import type { Track } from '../core/types'
import { IconDislike, IconHeart, IconHeartFilled, IconList, IconNext, IconPause, IconPlay, IconShuffle, IconSliders } from './icons'

interface Wave {
  type: string
  tag: string
  name: string
  icon?: string
}

export default function HomePage() {
  const [wave, setWave] = useState<Wave | null>(null)
  const [loadingWave, setLoadingWave] = useState(false)
  const showToast = useApp((s) => s.showToast)
  const likedKeys = useApp((s) => s.likedKeys)
  const toggleLike = useApp((s) => s.toggleLike)
  const user = useApp((s) => s.user)
  const [snap, setSnap] = useState(() => player.snapshot())
  useEffect(() => player.onChange(setSnap), [])
  const [waveSettingsOpen, setWaveSettingsOpen] = useState(false)
  const [choice, setChoice] = useState<WaveChoice>({ label: 'Моя волна' })
  const nav = useNavigate()

  const firstName = user?.firstName ?? (user?.displayName ?? user?.name ?? '').split(/\s+/)[0] ?? user?.login ?? ''

  // Найти «Мою волну» в дашборде радио
  useEffect(() => {
    void findWaveStation()
      .then((st) => {
        if (!st?.id?.type || !st.id.tag) return
        setWave({
          type: st.id.type,
          tag: st.id.tag,
          name: st.name ?? 'Моя волна',
          icon: st.icon?.uri,
        })
      })
      .catch(() => {
        /* радио недоступно — показываем фон-заглушку */
      })
  }, [])

  const playWave = async (override?: WaveChoice) => {
    if (loadingWave) return
    const picked = override ?? choice
    setLoadingWave(true)
    try {
      let tracks: Track[] = []
      const seeds = buildSeeds(picked.moodSeed, picked.energySeed, picked.langSeed ?? undefined, picked.divSeed)
      // жанровая волна или «Моя волна» со всеми выбранными параметрами
      if (picked.genre) {
        tracks = await fetchGenreTracks(picked.genre, seeds)
      } else {
        tracks = await fetchWaveTracks(seeds)
        // если станция ещё не определена — попробуем найти
        if (!tracks.length && !wave) {
          const st = await findWaveStation().catch(() => null)
          if (st?.id?.type && st.id.tag) {
            setWave({ type: st.id.type, tag: st.id.tag, name: st.name ?? 'Моя волна', icon: st.icon?.uri })
          }
        }
      }
      if (!tracks.length) {
        showToast('Волна не вернула треки (возможно, нужна подписка)', 'error')
        return
      }
      await player.playQueue(
        tracks.map((track) => ({ track, source: 'radio' as const })),
        0,
        picked.genre ? { type: 'genre', tag: picked.genre } : { type: WAVE.type, tag: WAVE.tag },
      )
      showToast('🎵 ' + picked.label + ' — играет')
    } catch (e) {
      showToast('Ошибка волны: ' + (e as Error).message, 'error')
    } finally {
      setLoadingWave(false)
    }
  }

  const onHeroPlay = async () => {
    if (snap.current && snap.queue.length) {
      await player.toggle()
      return
    }
    await playWave()
  }

  // «Не нравится» в радио: фидбек станции и пропуск трека
  const dislikeWave = async () => {
    await player.dislikeCurrent()
  }

  const cur = snap.current
  const playing = snap.playing && !!cur
  const liked = cur ? likedKeys.has(trackKey(cur.track)) : false

  // фон: обложка играющего трека (или значка волны) — размытая и анимированная на весь экран
  const heroBg = cur?.track.coverUri
    ? coverUrl(cur.track.coverUri, '1000x1000')
    : wave?.icon
      ? coverUrl(wave.icon, '600x600')
      : undefined

  return (
    <div className={'wave' + (heroBg ? '' : ' wave--fallback')}>
      {heroBg && <div className="wave-bg" style={{ backgroundImage: `url(${heroBg})` }} />}
      <div className="wave-glow" />
      <div className="wave-main">
        {!cur && (
          <>
            <div className="wave-greet">
              <span className="wave-greet-hello">{firstName ? `Привет, ${firstName}!` : 'Добро пожаловать!'}</span>
              <span className="wave-greet-sub">Что послушаем сегодня?</span>
            </div>
            <div className="wave-quick">
              <button className="wave-quick-chip" onClick={() => nav('/playlists')} title="Мои плейлисты">
                <IconList size={17} /> Мои плейлисты
              </button>
            </div>
          </>
        )}
        <div className="wave-label">
          {choice.genre ? GENRES.find((g) => g.tag === choice.genre)?.name.toUpperCase() ?? 'ЖАНРОВАЯ ВОЛНА' : 'МОЯ ВОЛНА'}
          <button className="wave-settings-btn" onClick={() => setWaveSettingsOpen(true)} title="Настроить волну">
            <IconSliders size={15} />
          </button>
        </div>

        <button
          className="wave-disc"
          onClick={() => void onHeroPlay()}
          disabled={loadingWave}
          title={playing ? 'Пауза' : 'Слушать Мою волну'}
        >
          <img
            src={coverUrl(cur?.track.coverUri ?? wave?.icon, '400x400') ?? PLACEHOLDER_COVER}
            alt=""
            className={playing ? 'spin' : ''}
            onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
          />
          <span className="wave-disc-glass" />
          <span className="wave-disc-center">
            {loadingWave ? '…' : playing ? <IconPause size={30} /> : <IconPlay size={30} />}
          </span>
        </button>

        {cur ? (
          <>
            <div className="wave-track-title">{cur.track.title}</div>
            <ArtistLink artists={cur.track.artists} className="wave-track-artist" />
            <div className="wave-progress">
              <span className="wave-time">{formatMs(snap.positionMs)}</span>
              <input
                type="range"
                className="range"
                min={0}
                max={Math.max(snap.durationMs, 1)}
                value={Math.min(snap.positionMs, Math.max(snap.durationMs, 1))}
                onChange={(e) => player.seek(Number(e.target.value))}
                aria-label="Перемотка"
              />
              <span className="wave-time">{formatMs(snap.durationMs)}</span>
            </div>
          </>
        ) : (
          <div className="wave-track-artist">Бесконечный поток под ваш вкус — нажмите на диск</div>
        )}

        <div className="wave-controls">
          {cur && (
            <button
              className={'wave-ctl' + (liked ? ' on' : '')}
              onClick={() => void toggleLike(cur.track)}
              title={liked ? 'Убрать из «Избранное»' : 'В «Избранное»'}
            >
              {liked ? <IconHeartFilled size={26} /> : <IconHeart size={26} />}
            </button>
          )}
          {cur?.source === 'radio' && (
            <button
              className="wave-ctl"
              onClick={() => void dislikeWave()}
              title="Не нравится — пропустить"
            >
              <IconDislike size={26} />
            </button>
          )}
          <button className="wave-playbig" onClick={() => void onHeroPlay()} disabled={loadingWave}>
            {loadingWave ? '…' : playing ? <IconPause size={28} /> : <IconPlay size={28} />}
          </button>
          {cur?.source === 'radio' && (
            <button className="wave-ctl" onClick={() => void player.next()} title="Дальше">
              <IconNext size={26} />
            </button>
          )}
          <button
            className={'wave-ctl' + (snap.shuffle ? ' on' : '')}
            onClick={() => player.setShuffle(!snap.shuffle)}
            title={snap.shuffle ? 'Перемешивание выключено' : 'Перемешивание включено'}
          >
            <IconShuffle size={26} />
          </button>
        </div>
      </div>
      {waveSettingsOpen && (
        <WaveSettings
          current={choice}
          onApply={(c) => {
            setChoice(c)
            void playWave(c)
          }}
          onClose={() => setWaveSettingsOpen(false)}
        />
      )}
    </div>
  )
}