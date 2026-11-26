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

export interface SleepTimerState {
  /** off — выключен, time — до времени, track-end — до конца трека */
  mode: 'off' | 'time' | 'track-end'
  /** момент срабатывания (ms epoch); null для off и track-end */
  endsAt: number | null
  /** изначальная длительность в ms (для отображения) */
  totalMs: number | null
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
  playbackRate: number
  error: string | null
  buffering: boolean
  sleepTimer: SleepTimerState
  /** остаток таймера сна в ms (для mode='time'); null если не активен */
  sleepRemainingMs: number | null
  /** true, если играет радио-станция (доступны лайк/дизлайк) */
  isRadio: boolean
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
  playbackRate: 1,
  error: null,
  buffering: false,
  sleepTimer: { mode: 'off', endsAt: null, totalMs: null },
  sleepRemainingMs: null,
  isRadio: false,
}

class Player {
  private audio: HTMLAudioElement = new Audio()
  private queue: PlayableTrack[] = []
  private index = -1
  private volume = 1
  private muted = false
  private shuffle = false
  private repeat: 'off' | 'all' | 'one' = 'off'
  private playbackRate: number = 1
  private error: string | null = null
  private buffering = false
  private listeners = new Set<SnapshotListener>()
  // Радио-состояние
  private radio: { type: string; tag: string; session?: RadioSessionResume } | null = null
  // Защита от бесконечного скипа битых треков (в фоне play() может отклоняться)
  private consecutiveFailures = 0
  private lastPersist = 0
  // Таймер сна
  private sleepTimer: SleepTimerState = { mode: 'off', endsAt: null, totalMs: null }
  private sleepFadeStarted = false
  private preSleepVolume: number | null = null

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
    a.addEventListener('timeupdate', () => {
      // Таймер сна проверяем на каждом тике — аудио-события идут и в фоне,
      // в отличие от setTimeout, который Android троттлит
      this.checkSleepTimer()
      this.throttledEmit()
    })
    a.addEventListener('durationchange', () => this.emit())
    a.addEventListener('volumechange', () => this.emit())
    a.addEventListener('ended', () => void this.onEnded())
    a.addEventListener('error', () => {
      this.error = 'Не удалось воспроизвести трек (сервис или регион недоступны)'
      this.buffering = false
      this.emit()
      // Телеметрия: какая именно ошибка аудио и на какой ссылке
      try {
        const mediaError = this.audio.error
        void fetch('/__diag', {
          method: 'POST',
          body: JSON.stringify({
            fact: 'audio-error',
            href: location.href,
            code: mediaError ? String(mediaError.code) : '?',
            msg: mediaError ? String(mediaError.message) : '',
            src: String(this.audio.currentSrc ?? this.audio.src ?? '').slice(0, 120),
            cur: this.queue[this.index]?.track?.id ?? '',
          }),
        }).catch(() => {})
      } catch {
        /* ignore */
      }
      // При ошибке медиа в середине трека — пробуем следующий, а не застреваем
      if (this.queue[this.index]) {
        void this.failTrack('Не удалось воспроизвести трек')
      }
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
    const remaining =
      this.sleepTimer.mode === 'time' && this.sleepTimer.endsAt
        ? Math.max(0, this.sleepTimer.endsAt - Date.now())
        : null
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
      playbackRate: this.playbackRate,
      error: this.error,
      buffering: this.buffering,
      sleepTimer: { ...this.sleepTimer },
      sleepRemainingMs: remaining,
      isRadio: !!this.radio,
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
    this.consecutiveFailures = 0
    // Preserve sleep timer when replacing queue
    this.persist(true)
    return this.loadAndPlay(this.queue[this.index])
  }

  async playTrack(track: Track, source: PlayableTrack['source'] = 'queue'): Promise<boolean> {
    return this.playQueue([{ track, source }], 0)
  }

  /** Добавить треки в конец очереди (не прерывая текущий) */
  enqueue(items: PlayableTrack[]): void {
    this.queue.push(...items)
    this.persist(true)
    this.emit()
  }

  /** Играть трек из очереди по индексу (прыжок в очереди) */
  async playIndex(i: number): Promise<boolean> {
    if (i < 0 || i >= this.queue.length) return false
    this.index = i
    this.emit()
    return this.loadAndPlay(this.queue[i])
  }

  /** Убрать трек из очереди (текущий не трогаем, при удалении текущего играем следующий) */
  removeIndex(i: number): void {
    if (i < 0 || i >= this.queue.length) return
    const wasCurrent = i === this.index
    this.queue.splice(i, 1)
    if (wasCurrent) {
      this.index = Math.min(i, Math.max(this.queue.length - 1, -1))
      if (this.index >= 0) {
        void this.loadAndPlay(this.queue[this.index])
      } else {
        this.stop()
      }
    } else if (i < this.index) {
      this.index--
    }
    this.emit()
  }

  async toggle(): Promise<boolean> {
    if (this.audio.paused) {
      return this.audio
        .play()
        .then(() => {
          this.emit()
          return true
        })
        .catch(() => false)
    }
    this.audio.pause()
    this.emit()
    return true
  }

  /** пауза (для удалённого управления Ynison) */
  pause(): void {
    if (!this.audio.paused) {
      this.audio.pause()
      this.emit()
    }
  }

  /** продолжить (для удалённого управления Ynison) */
  resume(): void {
    if (this.audio.paused) {
      void this.audio.play().then(() => {
        this.emit()
      }).catch(() => {})
    }
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
    this.audio.volume = this.muted ? 0 : this.volume
    this.saveSettings()
  }

  setMuted(m: boolean): void {
    this.muted = m
    this.audio.muted = m
    this.audio.volume = m ? 0 : this.volume
    this.saveSettings()
    this.emit()
  }

  setShuffle(s: boolean): void {
    this.shuffle = s
    this.saveSettings()
    this.emit()
  }

  setRepeat(r: 'off' | 'all' | 'one'): void {
    this.repeat = r
    this.saveSettings()
    this.emit()
  }

  setPlaybackRate(rate: number): void {
    const r = [0.5, 0.75, 1, 1.25, 1.5, 2].includes(rate) ? rate : 1
    this.playbackRate = r
    this.audio.playbackRate = r
    this.saveSettings()
    this.emit()
  }

  // ---------- Таймер сна ----------

  /** Установить таймер на N минут */
  setSleepTimerMinutes(minutes: number): void {
    if (!Number.isFinite(minutes) || minutes <= 0) return
    const ms = Math.round(minutes * 60_000)
    this.sleepTimer = { mode: 'time', endsAt: Date.now() + ms, totalMs: ms }
    this.sleepFadeStarted = false
    this.preSleepVolume = null
    this.saveSettings()
    this.emit()
  }

  /** Остановить воспроизведение по окончании текущего трека */
  setSleepTimerTrackEnd(): void {
    this.sleepTimer = { mode: 'track-end', endsAt: null, totalMs: null }
    this.sleepFadeStarted = false
    this.preSleepVolume = null
    this.saveSettings()
    this.emit()
  }

  /** Снять таймер */
  cancelSleepTimer(): void {
    // если было затухание — вернуть громкость
    if (this.preSleepVolume !== null) {
      this.volume = this.preSleepVolume
      this.audio.volume = this.muted ? 0 : this.volume
      this.preSleepVolume = null
    }
    this.sleepTimer = { mode: 'off', endsAt: null, totalMs: null }
    this.sleepFadeStarted = false
    this.saveSettings()
    this.emit()
  }

  /** Продлить таймер на N минут (для кнопки «+5 мин») */
  extendSleepTimer(minutes: number): void {
    if (this.sleepTimer.mode !== 'time' || !this.sleepTimer.endsAt) return
    this.sleepTimer = {
      ...this.sleepTimer,
      endsAt: this.sleepTimer.endsAt + minutes * 60_000,
      totalMs: (this.sleepTimer.totalMs ?? 0) + minutes * 60_000,
    }
    this.sleepFadeStarted = false
    if (this.preSleepVolume !== null) {
      this.volume = this.preSleepVolume
      this.audio.volume = this.muted ? 0 : this.volume
      this.preSleepVolume = null
    }
    this.saveSettings()
    this.emit()
  }

  /** Проверка таймера — вызывается из timeupdate (работает и в фоне, в отличие от setTimeout) */
  private checkSleepTimer(): void {
    const rem = this.snapshot().sleepRemainingMs
    if (rem === null) return
    const FADE_MS = 20_000
    // плавное затухание за 20 секунд до конца
    if (rem <= FADE_MS && rem > 0 && !this.sleepFadeStarted) {
      this.sleepFadeStarted = true
      this.preSleepVolume = this.volume
    }
    if (this.sleepFadeStarted && this.preSleepVolume !== null) {
      const k = Math.max(0, rem / FADE_MS)
      this.audio.volume = this.muted ? 0 : this.preSleepVolume * k
    }
    if (rem <= 0) {
      this.finishSleepTimer()
    }
  }

  /** Таймер сработал: стоп, восстановление громкости */
  private finishSleepTimer(): void {
    const restore = this.preSleepVolume
    this.sleepTimer = { mode: 'off', endsAt: null, totalMs: null }
    this.sleepFadeStarted = false
    this.preSleepVolume = null
    this.audio.pause()
    if (restore !== null) {
      this.volume = restore
      this.audio.volume = this.muted ? 0 : restore
    }
    this.saveSettings()
    this.emit()
  }

  /** Сохранение пользовательских настроек (громкость/шафл/повтор/таймер) */
  private saveSettings(): void {
    try {
      const payload = {
        volume: this.volume,
        muted: this.muted,
        shuffle: this.shuffle,
        repeat: this.repeat,
        sleepTimer: this.sleepTimer,
      }
      localStorage.setItem('ym.settings', JSON.stringify(payload))
    } catch {
      /* ignore */
    }
  }

  /** Восстановление настроек при старте */
  loadSettings(): void {
    try {
      const raw = localStorage.getItem('ym.settings')
      if (!raw) return
      const d = JSON.parse(raw) as {
        volume?: number
        muted?: boolean
        shuffle?: boolean
        repeat?: 'off' | 'all' | 'one'
        sleepTimer?: SleepTimerState
      }
      if (typeof d.volume === 'number') {
        this.volume = Math.max(0, Math.min(1, d.volume))
        this.audio.volume = d.muted ? 0 : this.volume
      }
      if (typeof d.muted === 'boolean') {
        this.muted = d.muted
        this.audio.muted = d.muted
      }
      if (typeof d.shuffle === 'boolean') this.shuffle = d.shuffle
      if (d.repeat === 'off' || d.repeat === 'all' || d.repeat === 'one') this.repeat = d.repeat
      // таймер восстанавливаем только если он ещё не истёк
      if (d.sleepTimer?.mode === 'time' && d.sleepTimer.endsAt && d.sleepTimer.endsAt > Date.now()) {
        this.sleepTimer = d.sleepTimer
      }
      this.emit()
    } catch {
      /* ignore */
    }
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

  /** Восстановить очередь после перезапуска приложения (пауза, на позиции) */
  async restore(): Promise<void> {
    try {
      const raw = localStorage.getItem('ym.queue')
      if (!raw) return
      const data = JSON.parse(raw) as {
        ids?: string[]
        sources?: string[]
        index?: number
        positionMs?: number
        radio?: { type: string; tag: string } | null
      }
      if (!data?.ids?.length) return
      const byId = new Map<string, Track>()
      for (let i = 0; i < data.ids.length; i += 50) {
        const chunk = data.ids.slice(i, i + 50)
        try {
          const full = await ymClient.tracks(chunk)
          ;(full ?? []).forEach((t) => byId.set(String(t.id), t))
        } catch {
          /* часть очереди могла не загрузиться — продолжаем */
        }
      }
      const items: PlayableTrack[] = []
      data.ids.forEach((id, i) => {
        const t = byId.get(String(id))
        if (t) items.push({ track: t, source: (data.sources?.[i] as PlayableTrack['source']) ?? 'queue' })
      })
      if (!items.length) return
      this.queue = items
      this.index = Math.min(Math.max(data.index ?? 0, 0), items.length - 1)
      this.radio = data.radio ? { type: data.radio.type, tag: data.radio.tag, session: undefined } : null
      this.emit()
      const cur = this.queue[this.index]
      if (cur) {
        try {
          const choice = await resolveStreamUrl(cur.track)
          if (choice) {
            this.audio.src = choice.url
            this.audio.volume = this.muted ? 0 : this.volume
            // Позицию ставим только после загрузки метаданных, иначе браузер сбросит её в 0
            const seekTo = Math.max(0, (data.positionMs ?? 0) / 1000)
            const applySeek = () => {
              try {
                this.audio.currentTime = Math.min(seekTo, this.audio.duration || seekTo)
              } catch {
                /* ignore */
              }
            }
            if (this.audio.readyState >= 1) applySeek()
            else this.audio.addEventListener('loadedmetadata', applySeek, { once: true })
            this.updateMediaSession(cur)
            this.error = null
            this.emit()
          } else {
            this.error = 'Не удалось восстановить воспроизведение — нажмите play'
            this.emit()
          }
        } catch (e) {
          this.error = (e as Error).message || 'Не удалось восстановить воспроизведение'
          this.emit()
        }
      }
    } catch {
      /* нет сохранённой очереди — ок */
    }
  }

  /** Сохранить очередь/позицию (для восстановления после перезапуска) */
  private persist(force = false): void {
    const now = Date.now()
    if (!force && now - this.lastPersist < 2000) return
    this.lastPersist = now
    try {
      if (!this.queue.length) return
      const data = {
        ids: this.queue.map((q) => q.track.id),
        sources: this.queue.map((q) => q.source ?? 'queue'),
        index: this.index,
        positionMs: Math.round(this.audio.currentTime * 1000),
        radio: this.radio ? { type: this.radio.type, tag: this.radio.tag } : null,
      }
      localStorage.setItem('ym.queue', JSON.stringify(data))
    } catch {
      /* ignore */
    }
  }

  /** поставить/снять лайк текущему треку и уведомить */
  // (сама логика лайков — в UI через ymClient)

  // ---------- внутреннее ----------

  private async loadAndPlay(item: PlayableTrack): Promise<boolean> {
    try {
      const t0 = Date.now()
      const choice = await resolveStreamUrl(item.track)
      void this.diagPlay('resolve-ok ' + (Date.now() - t0) + 'ms url=' + (choice?.url ?? 'NULL').slice(0, 110))
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
      try {
        await this.audio.play()
        void this.diagPlay('playing-ok ' + item.track.id)
        this.consecutiveFailures = 0
        this.sendRadioFeedback('trackStarted')
        return true
      } catch (p) {
        void this.diagPlay('play-reject ' + String((p as Error)?.name ?? p) + ' | ' + String((p as Error)?.message ?? '').slice(0, 80))
        this.failTrack('Браузер отказал в воспроизведении: ' + ((p as Error)?.message || 'play()'))
        return false
      }
    } catch (e) {
      void this.diagPlay('resolve-fail ' + String((e as Error)?.message ?? e).slice(0, 120))
      this.failTrack((e as Error).message || 'Ошибка воспроизведения')
      return false
    }
  }

  private diagPlay(msg: string): void {
    try {
      void fetch('/__diag', {
        method: 'POST',
        body: JSON.stringify({ fact: 'play', href: location.href, msg: msg.slice(0, 160) }),
      }).catch(() => {})
    } catch {
      /* ignore */
    }
  }

  private failTrack(reason: string): void {
    this.error = reason
    this.buffering = false
    this.consecutiveFailures++
    this.emit()
    // Не скипаем всю очередь бесконечно: после 3 подряд ошибок — стоп
    if (this.consecutiveFailures >= 3) {
      this.consecutiveFailures = 0
      this.error = 'Не удалось воспроизвести. Проверьте соединение.'
      this.emit()
      this.stop()
      return
    }
    // пропускаем битый трек, уходя вперёд по очереди
    void this.step(1)
  }

  private async onEnded(): Promise<void> {
    // «Таймер сна: до конца трека» — останавливаемся вместо перехода
    if (this.sleepTimer.mode === 'track-end') {
      const restore = this.preSleepVolume
      this.sleepTimer = { mode: 'off', endsAt: null, totalMs: null }
      this.sleepFadeStarted = false
      this.preSleepVolume = null
      this.audio.pause()
      if (restore !== null) {
        this.volume = restore
        this.audio.volume = this.muted ? 0 : restore
      }
      this.saveSettings()
      this.emit()
      return
    }
    if (this.repeat === 'one' && this.audio.currentSrc) {
      this.audio.currentTime = 0
      void this.audio.play().catch(() => {})
      return
    }
    this.sendRadioFeedback('trackFinished')
    if (this.repeat === 'all' && this.index >= this.queue.length - 1) {
      this.index = -1
    }
    await this.step(1)
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
      if (this.repeat === 'all' && this.queue.length) {
        idx = 0
      } else {
        // Очередь кончилась — продолжаем похожими треками (как «Моя волна»)
        const extended = await this.extendWithSimilar()
        if (!extended) return false
        idx = this.index + 1
        if (idx >= this.queue.length) return false
      }
    }
    this.index = idx
    this.persist(true)
    return this.loadAndPlay(this.queue[idx])
  }

  /** Дополнить очередь похожими треками на текущий (бесконечное воспроизведение) */
  private async extendWithSimilar(): Promise<boolean> {
    const cur = this.queue[this.index]
    if (!cur || this.radio) return false
    if (this.queue.length > 300) return false
    try {
      const res = await ymClient.tracksSimilar(cur.track.id)
      const known = new Set(this.queue.map((q) => q.track.id))
      const ids = (res.similarTracks ?? [])
        .filter((t) => t && t.id && !known.has(String(t.id)))
        .map((t) => String(t.id))
        .slice(0, 20)
      if (!ids.length) return false
      const full = await ymClient.tracks(ids)
      const fresh = (full ?? [])
        .filter((t) => t && t.id && !known.has(String(t.id)))
        .map((t) => ({ track: t, source: 'queue' as const }))
      if (!fresh.length) return false
      this.queue.push(...fresh)
      this.persist(true)
      this.emit()
      return true
    } catch {
      return false
    }
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
    const played = this.audio && !isNaN(this.audio.currentTime) ? Math.round(this.audio.currentTime) : undefined
    void ymClient
      .radioFeedback(this.radio.type, this.radio.tag, kind, new Date().toISOString(), cur.track.id, played)
      .catch(() => {})
  }

  /** «Не нравится» в радио: фидбек станции + переход к следующему треку */
  async dislikeCurrent(): Promise<boolean> {
    const cur = this.queue[this.index]
    if (this.radio && cur) {
      const played = this.audio && !isNaN(this.audio.currentTime) ? Math.round(this.audio.currentTime) : undefined
      void ymClient
        .radioFeedback(this.radio.type, this.radio.tag, 'dislike', new Date().toISOString(), cur.track.id, played)
        .catch(() => {})
    }
    return this.next()
  }

  /** «Нравится» в радио: фидбек станции (без перехода) */
  likeCurrentRadio(): void {
    if (!this.radio) return
    const cur = this.queue[this.index]
    if (!cur) return
    const played = this.audio && !isNaN(this.audio.currentTime) ? Math.round(this.audio.currentTime) : undefined
    void ymClient
      .radioFeedback(this.radio.type, this.radio.tag, 'like', new Date().toISOString(), cur.track.id, played)
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
    this.persist()
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

// Восстанавливаем громкость/шафл/повтор/таймер при старте
if (typeof window !== 'undefined') {
  player.loadSettings()
}

// e2e-хук: доступ к плееру для тестов (индекс очереди, снапшот)
if (typeof window !== 'undefined') {
  ;(window as unknown as { __player: Player }).__player = player
}