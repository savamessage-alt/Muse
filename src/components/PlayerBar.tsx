import { useEffect, useState } from 'react'
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
} from './icons'

function useSnapshot(): PlayerSnapshot {
  const [snap, setSnap] = useState<PlayerSnapshot>(() => player.snapshot())
  useEffect(() => player.onChange(setSnap), [])
  return snap
}

export default function PlayerBar() {
  const snap = useSnapshot()
  const likedKeys = useApp((s) => s.likedKeys)
  const toggleLike = useApp((s) => s.toggleLike)
  const showToast = useApp((s) => s.showToast)
  const [expanded, setExpanded] = useState(false)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsError, setLyricsError] = useState('')
  const [lyricsTrackId, setLyricsTrackId] = useState('')
  const [queueOpen, setQueueOpen] = useState(false)
  const [similarOpen, setSimilarOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)

  const cur = snap.current
  const liked = cur ? likedKeys.has(trackKey(cur.track)) : false
  const duration = snap.durationMs || 0
  const position = snap.positionMs

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
          <button
            className={'icon-btn' + (snap.shuffle ? ' active' : '')}
            onClick={() => player.setShuffle(!snap.shuffle)}
            title="Перемешать"
          >
            <IconShuffle size={18} />
          </button>
          <button className="icon-btn" onClick={() => void player.prev()} title="Предыдущий">
            <IconPrev size={22} />
          </button>
          <button className="pb-play" onClick={() => void togglePlay()} title={snap.playing ? 'Пауза' : 'Играть'}>
            {snap.playing ? <IconPause size={24} /> : <IconPlay size={24} />}
          </button>
          <button className="icon-btn" onClick={() => void player.next()} title="Следующий">
            <IconNext size={22} />
          </button>
          <button
            className={'icon-btn' + (snap.repeat !== 'off' ? ' active' : '')}
            onClick={() => player.setRepeat(snap.repeat === 'off' ? 'all' : snap.repeat === 'all' ? 'one' : 'off')}
            title="Повтор: off / все / один"
          >
            <IconRepeat size={18} />
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
        {snap.buffering && <span className="buffering" title="Буферизация">…</span>}
        {snap.error && (
          <button
            className="pb-error-btn"
            title={snap.error + ' — нажмите, чтобы повторить'}
            onClick={() => void player.reloadCurrent()}
          >
            <IconError size={16} />
            <IconRefresh size={13} />
          </button>
        )}
        <button
          className={'icon-btn' + (lyricsOpen ? ' active' : '')}
          onClick={toggleLyrics}
          title="Текст песни"
        >
          <IconLyrics size={18} />
        </button>
        <button
          className={'icon-btn' + (similarOpen ? ' active' : '')}
          onClick={() => {
            if (!cur) {
              showToast('Сначала выберите трек')
              return
            }
            setSimilarOpen((v) => !v)
          }}
          title="Похожие треки"
        >
          <IconSimilar size={20} />
        </button>
        <button
          className={'icon-btn' + (sleepOpen ? ' active' : '') + (snap.sleepTimer.mode !== 'off' ? ' has-timer' : '')}
          onClick={() => setSleepOpen(true)}
          title="Таймер сна"
        >
          <IconSleepTimer size={18} />
        </button>
        <button className={'icon-btn' + (queueOpen ? ' active' : '')} onClick={() => setQueueOpen((v) => !v)} title="Очередь">
          <IconQueue size={20} />
          {snap.queue.length > 0 && <span className="queue-badge">{snap.queue.length}</span>}
        </button>
        <IconVolume size={18} className="pb-vol-icon" />
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

      {lyricsOpen && (
          <div className="pb-lyrics">
          <div className="pb-lyrics-head">
            <b>Текст песни</b>
            <button className="icon-btn" onClick={() => setLyricsOpen(false)} title="Закрыть">
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