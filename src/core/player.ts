// ============================================================
// Движок воспроизведения: очередь, радио, Media Session,
// автопереход, управление громкостью и перемоткой
// ============================================================

import { resolveStreamUrl } from './stream'
import { ymClient } from './client'
import type { RadioSessionResume, Track } from './types'

export interface PlayableTrack {
  track: Track
  /** контекст, из которого трек попал в очередь (для радио/подписок) */
  source?: 'radio' | 'queue' | 'playlist' | 'search'
}

export interface PlayerSnapshot {
  playing: boolean
  current: PlayableTrack | null
  index: number
  queue: PlayableTrack[]
  positionMs: number
  durationMs: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: 'off' | 'all' | 'one'
  error: string | null
  buffering: boolean
}

type SnapshotListener = (s: PlayerSnapshot) => void

const EMPTY: PlayerSnapshot = {
  playing: false,
  current: null,
  index: -1,
  queue: [],
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  muted: false,
  shuffle: false,
  repeat: 'off',
  error: null,
  buffering: false,
}

class Player {
  private audio: HTMLAudioElement = new Audio()
  private queue: PlayableTrack[] = []
  private index = -1
  private volume = 1
  private muted = false
  private shuffle = false
  private repeat: 'off' | 'all' | 'one' = 'off'
  private error: string | null = null
  private buffering = false
  private listeners = new Set<SnapshotListener>()
  // Радио-состояние
  private radio: { type: string; tag: string; session?: RadioSessionResume } | null = null

  constructor() {
    const a = this.audio
    a.preload = 'auto'

    a.addEventListener('play', () => this.emit())
    a.addEventListener('pause', () => this.emit())
    a.addEventListener('playing', () => {
      this.buffering = false
      this.emit()
    })
    a.addEventListener('waiting', () => {
      this.buffering = true
      this.emit()
    })
    a.addEventListener('timeupdate', () => this.throttledEmit())
    a.addEventListener('durationchange', () => this.emit())
    a.addEventListener('volumechange', () => this.emit())
    a.addEventListener('ended', () => void this.onEnded())
    a.addEventListener('error', () => {
      this.error = 'Не удалось воспроизвести трек (сервис или регион недоступны)'
      this.buffering = false
      this.emit()
    })

    // Медиа-клавиши и системный интерфейс (Media Session)
    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession
      try {
        ms.setActionHandler('play', () => void this.toggle())
        ms.setActionHandler('pause', () => void this.toggle())
        ms.setActionHandler('previoustrack', () => void this.prev())
        ms.setActionHandler('nexttrack', () => void this.next())
        ms.setActionHandler('seekto', (d) => {
          if (d.seekTime !== undefined) void this.seek(d.seekTime * 1000)
        })
        ms.setActionHandler('stop', () => void this.stop())
      } catch {
        /* не поддерживается */
      }
    }
  }

  // ---------- публичное API ----------

  snapshot(): PlayerSnapshot {
    return {
      playing: !this.audio.paused && !this.audio.ended,
      current: this.index >= 0 ? this.queue[this.index] ?? null : null,
      index: this.index,
      queue: this.queue,
      positionMs: this.audio.currentTime * 1000,
      durationMs: Number.isFinite(this.audio.duration) ? this.audio.duration * 1000 : 0,
      volume: this.volume,
      muted: this.muted,
      shuffle: this.shuffle,
      repeat: this.repeat,
      error: this.error,
      buffering: this.buffering,
    }
  }

  onChange(fn: SnapshotListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Воспроизвести очередь с указанного индекса */
  async playQueue(items: PlayableTrack[], start = 0, radio?: { type: string; tag: string }): Promise<boolean> {
    if (!items.length) return false
    this.queue = items
    this.index = Math.min(Math.max(start, 0), items.length - 1)
    this.radio = radio
      ? { type: radio.type, tag: radio.tag, session: undefined }
      : null
    this.error = null
    return this.loadAndPlay(this.queue[this.index])
  }

  async playTrack(track: Track, source: PlayableTrack['source'] = 'queue'): Promise<boolean> {
    return this.playQueue([{ track, source }], 0)
  }

  /** Добавить треки в конец очереди (не прерывая текущий) */
  enqueue(items: PlayableTrack[]): void {
    this.queue.push(...items)
    this.emit()
  }

  async toggle(): Promise<boolean> {
    if (this.audio.paused) return this.audio.play().then(() => true).catch(() => false)
    this.audio.pause()
    return true
  }

  /** пауза (для удалённого управления Ynison) */
  pause(): void {
    if (!this.audio.paused) this.audio.pause()
  }

  /** продолжить (для удалённого управления Ynison) */
  resume(): void {
    if (this.audio.paused) void this.audio.play().catch(() => {})
  }

  async next(): Promise<boolean> {
    if (this.repeat === 'one') {
      this.audio.currentTime = 0
      return this.audio.play().then(() => true).catch(() => false)
    }
    return this.step(1)
  }

  async prev(): Promise<boolean> {
    // если прошло более 5 секунд — перематываем к началу
    if (this.audio.currentTime > 5) {
      this.audio.currentTime = 0
      return true
    }
    return this.step(-1)
  }

  seek(ms: number): void {
    if (Number.isFinite(this.audio.duration)) {
      this.audio.currentTime = Math.max(0, Math.min(ms / 1000, this.audio.duration))
      this.emit()
    }
  }

  seekBy(ms: number): void {
    this.seek(this.audio.currentTime * 1000 + ms)
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    this.audio.volume = this.volume
  }

  setMuted(m: boolean): void {
    this.muted = m
    this.audio.muted = m
  }

  setShuffle(s: boolean): void {
    this.shuffle = s
    this.emit()
  }

  setRepeat(r: 'off' | 'all' | 'one'): void {
    this.repeat = r
    this.emit()
  }

  stop(): void {
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.emit()
  }

  /** перезапустить текущий трек (например, после смены качества) */
  async reloadCurrent(): Promise<boolean> {
    const cur = this.queue[this.index]
    if (!cur) return false
    return this.loadAndPlay(cur)
  }

  /** поставить/снять лайк текущему треку и уведомить */
  // (сама логика лайков — в UI через ymClient)

  // ---------- внутреннее ----------

  private async loadAndPlay(item: PlayableTrack): Promise<boolean> {
    try {
      const choice = await resolveStreamUrl(item.track)
      if (!choice) {
        this.failTrack('Не удалось получить ссылку на аудио')
        return false
      }
      this.audio.src = choice.url
      this.audio.volume = this.muted ? 0 : this.volume
      this.updateMediaSession(item)
      this.buffering = true
      this.error = null
      this.emit()
      await this.audio.play()
      this.sendRadioFeedback('trackStarted')
      return true
    } catch (e) {
      this.failTrack((e as Error).message || 'Ошибка воспроизведения')
      return false
    }
  }

  private failTrack(reason: string): void {
    this.error = reason
    this.buffering = false
    this.emit()
    void this.onEnded(true) // пробуем следующую
  }

  private async onEnded(skipError = false): Promise<void> {
    if (this.repeat === 'one' && this.audio.currentSrc) {
      this.audio.currentTime = 0
      void this.audio.play().catch(() => {})
      return
    }
    this.sendRadioFeedback('trackFinished')
    if (this.repeat === 'all' && this.index >= this.queue.length - 1) {
      this.index = -1
    }
    const goNext = await this.step(1)
    if (!goNext) {
      // конец очереди
    }
    void skipError
  }

  private async step(dir: 1 | -1): Promise<boolean> {
    if (!this.queue.length) return false

    // Радио: добираем треки, если осталось меньше 2
    if (this.radio && dir === 1) {
      await this.ensureRadioBuffer()
    }

    let idx = this.index
    if (this.shuffle && dir === 1 && this.queue.length > 1) {
      // случайный следующий, не повторяя текущий
      let n = idx
      while (n === idx) n = Math.floor(Math.random() * this.queue.length)
      idx = n
    } else {
      idx += dir
    }

    if (idx < 0) idx = this.queue.length - 1
    if (idx >= this.queue.length) {
      if (this.repeat === 'all' && this.queue.length) idx = 0
      else return false
    }
    this.index = idx
    return this.loadAndPlay(this.queue[idx])
  }

  private async ensureRadioBuffer(): Promise<void> {
    if (!this.radio || this.queue.length - this.index >= 2) return
    try {
      const res = await ymClient.radioStationTracks(this.radio.type, this.radio.tag)
      this.radio.session = {
        sequence: [...(this.radio.session?.sequence ?? []), ...(res.sequence ?? [])],
        batchId: res.batchId,
        sessionId: res.sessionId,
        radioSessionId: res.radioSessionId,
      }
      const newTracks = (res.sequence ?? [])
        .filter((s) => s.type === 'track' && s.track)
        .map((s) => ({ track: s.track as Track, source: 'radio' as const }))
      // не дублируем уже добавленные
      const known = new Set(this.queue.map((q) => q.track.id))
      const fresh = newTracks.filter((t) => !known.has(t.track.id))
      this.queue.push(...fresh)
    } catch {
      /* без интернета или сессия закрыта — просто играем то, что есть */
    }
  }

  private sendRadioFeedback(kind: 'trackStarted' | 'trackFinished'): void {
    if (!this.radio) return
    const cur = this.queue[this.index]
    if (!cur) return
    void ymClient
      .radioFeedback(this.radio.type, this.radio.tag, kind, new Date().toISOString(), cur.track.id)
      .catch(() => {})
  }

  private updateMediaSession(item: PlayableTrack): void {
    if (!('mediaSession' in navigator)) return
    const t = item.track
    const artists = (t.artists ?? []).map((a) => a.name).join(', ')
    const coverUri = t.coverUri
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: artists || 'Неизвестный артист',
        album: t.albums?.[0]?.title ?? '',
        artwork: coverUri
          ? [{ src: `https://${coverUri.replace('%%', '600x600')}`, sizes: '600x600', type: 'image/jpeg' }]
          : [],
      })
    } catch {
      /* ignore */
    }
  }

  private emit(): void {
    const s = this.snapshot()
    this.listeners.forEach((fn) => fn(s))
  }

  private lastEmit = 0
  private throttledEmit(): void {
    const now = Date.now()
    if (now - this.lastEmit < 250) return
    this.lastEmit = now
    this.emit()
  }
}

export const player = new Player()