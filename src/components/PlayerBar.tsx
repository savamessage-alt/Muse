import { useEffect, useRef, useState } from 'react'
import { player, type PlayerSnapshot } from '../core/player'
import { ymClient } from '../core/client'
import { useApp } from '../state/store'
import { coverUrl, formatMs, trackKey, PLACEHOLDER_COVER } from '../core/format'
import { ArtistLink } from './ArtistLink'
import { diag } from '../core/diag'
import QueuePanel from './QueuePanel'
import SimilarPanel from './SimilarPanel'
import { LyricsPanel } from './LyricsPanel'
import ExpandedPlayer from './ExpandedPlayer'
import SleepTimerSheet from './SleepTimerSheet'
import DropdownMenu from './DropdownMenu'
import { SPEEDS } from './SpeedMenu'
import {
  IconPlay,
  IconPause,
  IconPrev,
  IconNext,
  IconHeart,
  IconHeartFilled,
  IconVolume,
  IconRepeat,
  IconShuffle,
  IconQueue,
  IconLyrics,
  IconSimilar,
  IconError,
  IconMusicNote,
  IconRefresh,
  IconX,
  IconSleepTimer,
  IconMore,
  IconCheck,
} from './icons'

function useSnapshot(): PlayerSnapshot {
  const [snap, setSnap] = useState<PlayerSnapshot>(() => player.snapshot())
  useEffect(() => {
    const unsub = player.onChange(setSnap)
    return () => unsub()
  }, [])
  return snap
}

export default function PlayerBar() {
  const snap = useSnapshot()
  const likedKeys = useApp((s) => s.likedKeys)
  const toggleLike = useApp((s) => s.toggleLike)
  const showToast = useApp((s) => s.showToast)
  const addListeningTime = useApp((s) => s.addListeningTime)
  const [expanded, setExpanded] = useState(false)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsError, setLyricsError] = useState('')
  const [lyricsTrackId, setLyricsTrackId] = useState('')
  const [queueOpen, setQueueOpen] = useState(false)
  const [similarOpen, setSimilarOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const cur = snap.current
  const liked = cur ? likedKeys.has(trackKey(cur.track)) : false
  const duration = snap.durationMs || 0
  const position = snap.positionMs

  const repeatLabel = snap.repeat === 'off' ? 'выкл' : snap.repeat === 'all' ? 'все' : 'один'
  const sleepLabel =
    snap.sleepTimer.mode === 'off'
      ? 'выкл'
      : snap.sleepTimer.mode === 'track-end'
        ? 'после трека'
        : `${Math.max(0, Math.round((snap.sleepRemainingMs ?? 0) / 60000))} мин`

  const closeMenu = () => setMenuOpen(false)

  // отслеживание времени прослушивания — каждую секунду при проигрывании
  const lastPosRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  useEffect(() => {
    if (!cur || !snap.playing) {
      lastPosRef.current = null
      return
    }
    const now = Date.now()
    if (lastPosRef.current != null) {
      const dt = now - lastTimeRef.current
      const dp = snap.positionMs - lastPosRef.current
      if (Math.abs(dp) <= 2000 && dt > 0) {
        addListeningTime(Math.min(dp, dt))
      }
    }
    lastPosRef.current = snap.positionMs
    lastTimeRef.current = now
  }, [snap.playing, snap.positionMs, cur, addListeningTime])

  // глобальные хоткеи: пробел — пауза/играть, ←/→ — перемотка на 5 с,
  // L — лайк, N/P — следующий/предыдущий, M — mute
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, textarea, select, [contenteditable]') || t.tagName === 'BUTTON')) return
      if (e.code === 'Space') {
        e.preventDefault()
        void player.toggle()
      } else if (e.key === 'ArrowRight' && snap.current) {
        e.preventDefault()
        player.seek(snap.positionMs + 5000)
      } else if (e.key === 'ArrowLeft' && snap.current) {
        e.preventDefault()
        player.seek(Math.max(0, snap.positionMs - 5000))
      } else if ((e.key === 'l' || e.key === 'L' || e.key === 'д' || e.key === 'Д') && cur) {
        e.preventDefault()
        void toggleLike(cur.track)
      } else if ((e.key === 'n' || e.key === 'N') && snap.current) {
        e.preventDefault()
        void player.next()
      } else if ((e.key === 'p' || e.key === 'P') && snap.current) {
        e.preventDefault()
        void player.prev()
      } else if ((e.key === 'm' || e.key === 'M') && snap.current) {
        e.preventDefault()
        player.setMuted(!snap.muted)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [snap.current, snap.positionMs, snap.muted, cur, toggleLike])

  const onSeek = (ms: number) => player.seek(ms)

  const togglePlay = async () => {
    if (!snap.current && snap.queue.length === 0) {
      showToast('Очередь пуста — выберите трек')
      return
    }
    await player.toggle()
  }

  const openExpanded = () => {
    if (!cur) {
      showToast('Сначала выберите трек')
      return
    }
    setExpanded(true)
  }

  // загрузка текста песни (при открытии и по кнопке «Повторить»)
  const loadLyrics = (trackId: string) => {
    setLyricsLoading(true)
    setLyricsError('')
    setLyrics('')
    let did = false
    const timer = window.setTimeout(() => {
      if (!did) void fetch('/__diag', { method: 'POST', body: JSON.stringify({ fact: 'lyrics', href: location.href, msg: 'загрузка >10с' }) }).catch(() => {})
    }, 10000)
    void ymClient
      .trackLyrics(trackId)
      .then((res) => {
        did = true
        window.clearTimeout(timer)
        diag('lyrics: OK len=' + String(res.lyric ?? '').length)
        setLyrics(res.lyric ?? '')
        setLyricsTrackId(trackId)
        setLyricsLoading(false)
      })
      .catch((e) => {
        did = true
        window.clearTimeout(timer)
        const msg = e instanceof Error ? e.message : String(e)
        // «No lyrics found» — это не сбой, у трека просто нет текста
        if (/no lyrics found/i.test(msg)) {
          diag('lyrics: нет текста у трека')
          setLyrics('')
          setLyricsTrackId(trackId)
          setLyricsLoading(false)
          return
        }
        diag('lyrics: ОШИБКА ' + msg.slice(0, 120))
        setLyricsError('Тексты недоступны: ' + msg)
        setLyricsLoading(false)
      })
  }

  const toggleLyrics = () => {
    if (lyricsOpen) {
      setLyricsOpen(false)
      return
    }
    if (!cur) {
      showToast('Сначала выберите трек')
      return
    }
    setLyricsOpen(true)
    if (cur.track.id === lyricsTrackId) return // уже загружено (текст или «нет текста») — при ошибке повтор при открытии
    loadLyrics(cur.track.id)
  }

  const retryLyrics = () => {
    if (!cur) return
    loadLyrics(cur.track.id)
  }

  // закрыть тексты, если трек сменился на другой
  useEffect(() => {
    if (cur && lyricsOpen && cur.track.id !== lyricsTrackId && lyrics) {
      setLyricsOpen(false)
    }
  }, [cur, lyricsOpen, lyricsTrackId, lyrics])

  return (
    <footer className="playerbar">
      {expanded && (
        <ExpandedPlayer
          onClose={() => setExpanded(false)}
          onLyrics={toggleLyrics}
          onQueue={() => setQueueOpen((v) => !v)}
          onSleepTimer={() => setSleepOpen(true)}
          onSimilar={() => {
            if (!cur) {
              showToast('Сначала выберите трек')
              return
            }
            setSimilarOpen((v) => !v)
          }}
        />
      )}
      {sleepOpen && <SleepTimerSheet snap={snap} onClose={() => setSleepOpen(false)} />}
      <div className="pb-track">
        {cur ? (
          <>
            <img
              src={coverUrl(cur.track.coverUri, '120x120') ?? PLACEHOLDER_COVER}
              className="pb-cover"
              alt=""
              onClick={openExpanded}
              title="Развернуть плеер"
              onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
            />
            <div className="pb-meta" onClick={openExpanded} title="Развернуть плеер">
              <div className="pb-title">
                {snap.playing && <span className="eq pb-eq" aria-hidden="true"><span /><span /><span /></span>}
                {cur.track.title}
              </div>
              <ArtistLink artists={cur.track.artists} className="pb-artist" />
            </div>
            <button
              className={'icon-btn' + (liked ? ' liked' : '')}
              onClick={() => cur && void toggleLike(cur.track)}
              title={liked ? 'Убрать из «Избранное»' : 'В «Избранное»'}
              aria-label={liked ? 'Убрать из «Избранное»' : 'В «Избранное»'}
              aria-pressed={liked}
            >
              {liked ? <IconHeartFilled /> : <IconHeart />}
            </button>
          </>
        ) : (
          <div className="pb-meta muted">Выберите трек</div>
        )}
      </div>

      <div className="pb-center">
        <div className="pb-controls">
          <button className="icon-btn" onClick={() => void player.prev()} title="Предыдущий" aria-label="Предыдущий трек">
            <IconPrev size={22} />
          </button>
          <button className="pb-play" onClick={() => void togglePlay()} title={snap.playing ? 'Пауза' : 'Играть'} aria-label={snap.playing ? 'Пауза' : 'Играть'}>
            {snap.playing ? <IconPause size={24} /> : <IconPlay size={24} />}
          </button>
          <button className="icon-btn" onClick={() => void player.next()} title="Следующий" aria-label="Следующий трек">
            <IconNext size={22} />
          </button>
        </div>
        <div className="pb-seek">
          <span className="pb-time">{formatMs(position)}</span>
          <input
            type="range"
            className="range"
            min={0}
            max={Math.max(duration, 1)}
            value={Math.min(position, Math.max(duration, 1))}
            onChange={(e) => onSeek(Number(e.target.value))}
            disabled={!cur}
            aria-label="Перемотка"
          />
          <span className="pb-time">{formatMs(duration)}</span>
        </div>
      </div>

      <div className="pb-right">
        {snap.buffering && <span className="buffering" title="Буферизация" aria-label="Буферизация">…</span>}
        {snap.error && (
          <button
            className="pb-error-btn"
            title={snap.error + ' — нажмите, чтобы повторить'}
            aria-label={'Ошибка воспроизведения: ' + snap.error + '. Повторить'}
            onClick={() => void player.reloadCurrent()}
          >
            <IconError size={16} />
            <span className="pb-error-text">Ошибка</span>
            <IconRefresh size={13} />
          </button>
        )}
        <button
          className={
            'icon-btn pb-more' +
            (menuOpen ? ' active' : '') +
            (snap.sleepTimer.mode !== 'off' ? ' has-timer' : '')
          }
          onClick={(e) => {
            setMenuAnchor(e.currentTarget)
            setMenuOpen((v) => !v)
          }}
          title="Все функции плеера"
          aria-label="Все функции плеера"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <IconMore size={20} />
          {snap.queue.length > 0 && (
            <span className="queue-badge" aria-label={`${snap.queue.length} треков в очереди`}>
              {snap.queue.length}
            </span>
          )}
        </button>
      </div>

      <DropdownMenu open={menuOpen} anchor={menuAnchor} onClose={closeMenu} minWidth={280} className="pb-menu">
        <div className="dropdown-title">Скорость</div>
        <div className="speed-chips">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={'speed-chip' + (snap.playbackRate === s ? ' active' : '')}
              onClick={() => player.setPlaybackRate(s)}
              aria-pressed={snap.playbackRate === s}
            >
              {s}×
            </button>
          ))}
        </div>

        <div className="dropdown-sep" />

        <button className="dropdown-item" onClick={() => player.setShuffle(!snap.shuffle)}>
          <IconShuffle size={16} />
          <span className="dropdown-item-name">Перемешать</span>
          {snap.shuffle && <IconCheck size={15} />}
        </button>
        <button
          className="dropdown-item"
          onClick={() => player.setRepeat(snap.repeat === 'off' ? 'all' : snap.repeat === 'all' ? 'one' : 'off')}
        >
          <IconRepeat size={16} />
          <span className="dropdown-item-name">Повтор</span>
          <span className="dropdown-count">{repeatLabel}</span>
        </button>

        <div className="dropdown-sep" />

        <button
          className="dropdown-item"
          onClick={() => {
            toggleLyrics()
            closeMenu()
          }}
        >
          <IconLyrics size={16} />
          <span className="dropdown-item-name">Текст песни</span>
          {lyricsOpen && <IconCheck size={15} />}
        </button>
        <button
          className="dropdown-item"
          onClick={() => {
            if (!cur) {
              showToast('Сначала выберите трек')
              closeMenu()
              return
            }
            setSimilarOpen((v) => !v)
            closeMenu()
          }}
        >
          <IconSimilar size={16} />
          <span className="dropdown-item-name">Похожие треки</span>
        </button>
        <button
          className="dropdown-item"
          onClick={() => {
            setQueueOpen((v) => !v)
            closeMenu()
          }}
        >
          <IconQueue size={16} />
          <span className="dropdown-item-name">Очередь</span>
          <span className="dropdown-count">{snap.queue.length}</span>
        </button>
        <button
          className="dropdown-item"
          onClick={() => {
            setSleepOpen(true)
            closeMenu()
          }}
        >
          <IconSleepTimer size={16} />
          <span className="dropdown-item-name">Таймер сна</span>
          {snap.sleepTimer.mode !== 'off' && <span className="dropdown-count">{sleepLabel}</span>}
        </button>

        <div className="dropdown-sep" />

        <div className="dropdown-vol">
          <IconVolume size={16} />
          <input
            type="range"
            className="range thin"
            min={0}
            max={1}
            step={0.01}
            value={snap.muted ? 0 : snap.volume}
            onChange={(e) => player.setVolume(Number(e.target.value))}
            aria-label="Громкость"
          />
        </div>
      </DropdownMenu>

      {lyricsOpen && (
          <div className="pb-lyrics">
          <div className="pb-lyrics-head">
            <b>Текст песни</b>
            <button className="panel-close" onClick={() => setLyricsOpen(false)} title="Закрыть" aria-label="Закрыть текст песни">
              <IconX size={16} />
            </button>
          </div>
          {lyricsLoading && (
            <div className="pb-lyrics-body">
              <div className="lyrics-loading" aria-label="Загрузка текста">
                <span className="skeleton-line" style={{ width: '94%' }} />
                <span className="skeleton-line" style={{ width: '70%' }} />
                <span className="skeleton-line" style={{ width: '86%' }} />
                <span className="skeleton-line" style={{ width: '48%' }} />
              </div>
            </div>
          )}
          {!lyricsLoading && lyricsError && (
            <div className="pb-lyrics-body">
              <div className="lyrics-state">
                <IconError size={34} />
                <div className="lyrics-state-text">{lyricsError}</div>
                <button className="btn small" onClick={retryLyrics}>
                  <IconRefresh size={14} /> Повторить
                </button>
              </div>
            </div>
          )}
          {!lyricsLoading && !lyricsError && (
            <div className="pb-lyrics-body">
              <LyricsPanel lyric={lyrics ?? ''} />
            </div>
          )}
        </div>
      )}

      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
      {similarOpen && cur && <SimilarPanel trackTitle={cur.track.title} onClose={() => setSimilarOpen(false)} />}
    </footer>
  )
}