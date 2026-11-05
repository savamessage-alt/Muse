import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ymClient } from '../core/client'
import { useApp } from '../state/store'
import { player } from '../core/player'
import { artistNames, coverUrl, formatMs, PLACEHOLDER_COVER } from '../core/format'
import type { Track } from '../core/types'
import { IconDislike, IconHeart, IconHeartFilled, IconList, IconNext, IconPause, IconPlay, IconShuffle } from './icons'

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
  const isLiked = useApp((s) => s.isLiked)
  const toggleLike = useApp((s) => s.toggleLike)
  const user = useApp((s) => s.user)
  const [snap, setSnap] = useState(() => player.snapshot())
  useEffect(() => player.onChange(setSnap), [])
  const nav = useNavigate()

  const firstName = user?.firstName ?? (user?.displayName ?? user?.name ?? '').split(/\s+/)[0] ?? user?.login ?? ''

  // Найти «Мою волну» (персональную станцию user:onyourwave) в дашборде радио
  useEffect(() => {
    ymClient
      .radioDashboard()
      .then((r) => {
        const list = r.stations ?? []
        const mine =
          list.find((s) => s.station?.id?.type === 'user' && s.station?.id?.tag === 'onyourwave') ??
          list.find((s) => s.station?.id?.type === 'user') ??
          list[0]
        if (mine) {
          const tp = mine.station?.id?.type ?? mine.id?.type ?? ''
          const tg = mine.station?.id?.tag ?? mine.id?.tag ?? ''
          if (tp && tg) {
            setWave({
              type: tp,
              tag: tg,
              name: mine.station?.name ?? 'Моя волна',
              icon: mine.station?.icon?.uri,
            })
          }
        }
      })
      .catch(() => {
        /* радио недоступно — показываем фон-заглушку */
      })
  }, [])

  const playWave = async () => {
    if (loadingWave) return
    setLoadingWave(true)
    try {
      // если станция ещё не определена (dashboard грузится) — дождёмся её
      let target = wave
      if (!target) {
        const r = await ymClient.radioDashboard()
        const list = r.stations ?? []
        const mine =
          list.find((s) => s.station?.id?.type === 'user' && s.station?.id?.tag === 'onyourwave') ??
          list.find((s) => s.station?.id?.type === 'user') ??
          list[0]
        const tp = mine?.station?.id?.type ?? mine?.id?.type ?? ''
        const tg = mine?.station?.id?.tag ?? mine?.id?.tag ?? ''
        if (tp && tg) {
          target = { type: tp, tag: tg, name: mine?.station?.name ?? 'Моя волна', icon: mine?.station?.icon?.uri }
          setWave(target)
        }
      }
      if (!target) {
        showToast('Моя волна пока недоступна (радио не ответило)', 'error')
        return
      }
      const res = await ymClient.radioStationTracks(target.type, target.tag)
      const tracks = (res.sequence ?? [])
        .filter((x) => x.type === 'track' && x.track)
        .map((x) => x.track as Track)
      if (!tracks.length) {
        showToast('Моя волна не вернула треки (возможно, нужна подписка)', 'error')
        return
      }
      await player.playQueue(
        tracks.map((track) => ({ track, source: 'radio' as const })),
        0,
        { type: target.type, tag: target.tag },
      )
      showToast('🎵 Моя волна — играет')
    } catch (e) {
      showToast('Ошибка Моей волны: ' + (e as Error).message, 'error')
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
  const liked = cur ? isLiked(cur.track) : false

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
        <div className="wave-label">МОЯ ВОЛНА</div>

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
            <div className="wave-track-artist">{artistNames(cur.track.artists)}</div>
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
    </div>
  )
}