// ============================================================
// Связка плеера с нативным медиа-виджетом (Android) и браузерным
// Media Session. Публикует состояние плеера один раз на изменения
// (трек/пауза/позиция/лайк) и обрабатывает действия от виджета.
// ============================================================

import { Capacitor } from '@capacitor/core'
import { backgroundPlayback, type PlaybackAction, type PlaybackState } from './background'
import { player } from './player'
import { useApp } from '../state/store'
import { coverUrl } from './format'

let started = false
let lastFingerprint = ''

function coverFor(coverUri?: string): string | undefined {
  return coverUri ? coverUrl(coverUri, '300x300') ?? undefined : undefined
}

/** Собрать пакет состояния для виджета */
export function buildPlaybackState(): PlaybackState | null {
  const snap = player.snapshot()
  const cur = snap.current
  if (!cur) return null
  const liked = useApp.getState().isLiked(cur.track)
  return {
    title: cur.track.title || 'Muse',
    artist: (cur.track.artists ?? []).map((a) => a.name).join(', ') || 'Неизвестный артист',
    album: cur.track.albums?.[0]?.title ?? '',
    artworkUrl: coverFor(cur.track.coverUri),
    playing: snap.playing,
    positionMs: Math.round(snap.positionMs),
    durationMs: Math.round(snap.durationMs),
    liked,
    canPrev: snap.index > 0 || (snap.shuffle && snap.queue.length > 1),
    canNext:
      snap.queue.length > 1 && snap.index < snap.queue.length - 1 ||
      (snap.queue.length > 1 && snap.repeat === 'all') ||
      (snap.queue.length > 0 && snap.repeat === 'one'),
  }
}

/** Опубликовать состояние в виджет (без дублей). */
function pushState(): void {
  if (!started) return
  const st = buildPlaybackState()
  if (!st) {
    backgroundPlayback.stop()
    return
  }
  // трек/пауза/позиция-секунда/лайк
  const fp = st.title + '\u0000' + st.playing + '\u0000' + Math.floor(st.positionMs / 500) + '\u0000' + st.liked
  if (fp === lastFingerprint && backgroundPlayback.active) return
  lastFingerprint = fp
  if (!backgroundPlayback.active) backgroundPlayback.start(st)
  else backgroundPlayback.update(st)
}

function handleAction(a: PlaybackAction): void {
  switch (a.action) {
    case 'play':
      void player.resume()
      break
    case 'pause':
      player.pause()
      break
    case 'next':
      void player.next()
      break
    case 'prev':
      void player.prev()
      break
    case 'seek':
      if (Number.isFinite(a.positionMs)) player.seek(a.positionMs)
      break
    case 'like': {
      const cur = player.snapshot().current
      if (cur) void useApp.getState().toggleLike(cur.track)
      break
    }
    case 'stop':
      player.stop()
      break
  }
}

/** Однократная инициализация медиа-контроля (вызывается из App на старте). */
export function initMediaControl(): void {
  if (started) return
  started = true

  if (!Capacitor.isNativePlatform()) {
    // На вебе/десктопе браузерный Media Session уже работает внутри player.ts —
    // нативный виджет не нужен. Ничего не делаем.
    started = false
    return
  }

  const unsubMedia = player.onChange(() => pushState())
  window.addEventListener('beforeunload', () => {
    unsubMedia()
  })
  useApp.subscribe((s, p) => {
    if (s.likedKeys !== p.likedKeys) pushState()
  })
  backgroundPlayback.onAction(handleAction)

  // push при старте (изменения уже приходят через onChange / subscribe)
  pushState()
}