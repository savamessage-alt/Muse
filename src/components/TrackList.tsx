import { useEffect, useState } from 'react'
import { player, type PlayableTrack } from '../core/player'
import { useApp } from '../state/store'
import { artistNames, coverUrl, formatMs, PLACEHOLDER_COVER } from '../core/format'
import type { Track } from '../core/types'
import { IconPlay, IconPause, IconHeart, IconHeartFilled } from './icons'

interface Props {
  tracks: Track[]
  /** вызывается по клику на строку (по умолчанию — очередь с этого места) */
  onPlay?: (index: number) => void
  showAlbum?: boolean
  showLikes?: boolean
  emptyText?: string
}

/** Воспроизвести список с указанного индекса (по умолчанию) */
export function playTracks(tracks: Track[], index = 0, source: PlayableTrack['source'] = 'queue') {
  if (!tracks.length) return
  void player.playQueue(tracks.map((track) => ({ track, source })), index)
}

export default function TrackList({ tracks, onPlay, showAlbum = true, showLikes = true, emptyText }: Props) {
  const [snap, setSnap] = useState(() => player.snapshot())
  useEffect(() => player.onChange(setSnap), [])
  const isLiked = useApp((s) => s.isLiked)
  const toggleLike = useApp((s) => s.toggleLike)

  if (!tracks.length) {
    return <div className="muted pad">{emptyText ?? 'Здесь пока пусто'}</div>
  }

  return (
    <div className="tracklist">
      <div className="trackrow trackhead">
        <span className="tc-idx">#</span>
        <span className="tc-title">Название</span>
        {showAlbum && <span className="tc-album">Альбом</span>}
        <span className="tc-time">Время</span>
        <span className="tc-like" />
      </div>
      {tracks.map((t, i) => {
        const playing = snap.current?.track.id === t.id && snap.playing
        const paused = snap.current?.track.id === t.id && !snap.playing
        const liked = isLiked(t)
        return (
          <div
            key={t.id + (t.albums?.[0]?.id ?? '')}
            className={'trackrow' + (snap.current?.track.id === t.id ? ' current' : '')}
            onDoubleClick={() => (onPlay ? onPlay(i) : playTracks(tracks, i))}
            onClick={() => (onPlay ? onPlay(i) : playTracks(tracks, i))}
            title="Двойной клик — играть"
          >
            <span className="tc-idx">
              {playing ? (
                <IconPause size={16} className="ic-playing" />
              ) : paused ? (
                <IconPlay size={16} className="ic-playing" />
              ) : (
                i + 1
              )}
            </span>
            <span className="tc-title">
              <img
                src={coverUrl(t.coverUri, '64x64') ?? PLACEHOLDER_COVER}
                className="tc-cover"
                alt=""
                onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
              />
              <span className="tc-title-wrap">
                <span className="tc-name">{t.title}</span>
                <span className="tc-artists">{artistNames(t.artists)}</span>
              </span>
            </span>
            {showAlbum && (
              <span className="tc-album">
                <a className="tc-album-link" href={`#/album/${t.albums?.[0]?.id ?? ''}`} onClick={(e) => e.stopPropagation()}>
                  {t.albums?.[0]?.title ?? ''}
                </a>
              </span>
            )}
            <span className="tc-time">{formatMs(t.durationMs ?? 0)}</span>
            <span className="tc-like">
              {showLikes && (
                <button
                  className={'icon-btn small' + (liked ? ' liked' : '')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void toggleLike(t)
                  }}
                  title={liked ? 'Убрать лайк' : 'Лайк'}
                >
                  {liked ? <IconHeartFilled size={16} /> : <IconHeart size={16} />}
                </button>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}