import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { player, type PlayerSnapshot } from '../core/player'
import { ymClient } from '../core/client'
import { useApp } from '../state/store'
import { coverUrl, formatMs, PLACEHOLDER_COVER, artistNames } from '../core/format'
import { diag } from '../core/diag'
import QueuePanel from './QueuePanel'
import SimilarPanel from './SimilarPanel'
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
} from './icons'

function useSnapshot(): PlayerSnapshot {
  const [snap, setSnap] = useState<PlayerSnapshot>(() => player.snapshot())
  useEffect(() => player.onChange(setSnap), [])
  return snap
}

export default function PlayerBar() {
  const navigate = useNavigate()
  const snap = useSnapshot()
  const isLiked = useApp((s) => s.isLiked)
  const toggleLike = useApp((s) => s.toggleLike)
  const showToast = useApp((s) => s.showToast)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsError, setLyricsError] = useState('')
  const [lyricsTrackId, setLyricsTrackId] = useState('')
  const [queueOpen, setQueueOpen] = useState(false)
  const [similarOpen, setSimilarOpen] = useState(false)

  const cur = snap.current
  const liked = cur ? isLiked(cur.track) : false
  const duration = snap.durationMs || 0
  const position = snap.positionMs

  const onSeek = (ms: number) => player.seek(ms)

  const togglePlay = async () => {
    if (!snap.current && snap.queue.length === 0) {
      showToast('Очередь пуста — выберите трек')
      return
    }
    await player.toggle()
  }

  const queueOpenFn = () => {
    showToast(`В очереди: ${snap.queue.length} треков`)
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

  // без таймкодов: [00:12.34] → чисто
  const cleanLyrics = (lyrics ?? '').replace(/\[\d{2}:\d{2}(\.\d+)?\]/g, '').trim()

  return (
    <footer className="playerbar">
      <div className="pb-track">
        {cur ? (
          <>
            <img
              src={coverUrl(cur.track.coverUri, '120x120') ?? PLACEHOLDER_COVER}
              className="pb-cover"
              alt=""
              onClick={() => navigate('/')}
              title="Открыть «Мою волну»"
              onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
            />
            <div className="pb-meta" onClick={() => navigate('/')} title="Открыть «Мою волну»">
              <div className="pb-title">{cur.track.title}</div>
              <div className="pb-artist" title={artistNames(cur.track.artists)}>
                {artistNames(cur.track.artists)}
              </div>
            </div>
            <button
              className={'icon-btn' + (liked ? ' liked' : '')}
              onClick={() => cur && void toggleLike(cur.track)}
              title={liked ? 'Убрать из «Мне нравится»' : 'В «Мне нравится»'}
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
        {snap.error && <span className="pb-error" title={snap.error}>⚠</span>}
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
          <div className="pb-lyrics-body">
            {lyricsLoading && (
              <div className="lyrics-loading" aria-label="Загрузка текста">
                <span className="skeleton-line" style={{ width: '94%' }} />
                <span className="skeleton-line" style={{ width: '70%' }} />
                <span className="skeleton-line" style={{ width: '86%' }} />
                <span className="skeleton-line" style={{ width: '48%' }} />
              </div>
            )}
            {!lyricsLoading && lyricsError && (
              <div className="lyrics-state">
                <IconError size={34} />
                <div className="lyrics-state-text">{lyricsError}</div>
                <button className="btn small" onClick={retryLyrics}>
                  <IconRefresh size={14} /> Повторить
                </button>
              </div>
            )}
            {!lyricsLoading && !lyricsError && cleanLyrics && <pre className="lyrics-text">{cleanLyrics}</pre>}
            {!lyricsLoading && !lyricsError && !cleanLyrics && (
              <div className="lyrics-state">
                <IconMusicNote size={34} />
                <div className="lyrics-state-text">Для этого трека текст пока недоступен</div>
              </div>
            )}
          </div>
        </div>
      )}

      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
      {similarOpen && cur && <SimilarPanel trackTitle={cur.track.title} onClose={() => setSimilarOpen(false)} />}
    </footer>
  )
}