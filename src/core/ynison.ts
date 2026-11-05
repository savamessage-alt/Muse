// ============================================================
// Ynison — синхронизация плееров (текущий трек, управление)
// Протокол: WebSocket + JSON-фреймы (без бинарного protobuf)
// По исходникам MarshalX/yandex-music-api (yandex_music/ynison)
//  1) редирект-сервис выдаёт хост + redirect_ticket + session_id
//  2) state-соединение на wss://{host}/ynison_state.../PutYnisonState
//     с subprotocols ['Bearer','v2', JSON-метаданные устройства]
//  3) фреймы — JSON (camelCase), сервер присылает состояние и
//     команды других устройств
// ============================================================

const BASE_URL = 'wss://ynison.music.yandex.ru'
const REDIRECT_SERVICE = 'redirector.YnisonRedirectService/GetRedirectToYnison'
const STATE_SERVICE = 'ynison_state.YnisonStateService/PutYnisonState'
const DEFAULT_TITLE = 'Muse'

export interface YnisonRemoteActions {
  /** другое устройство включило трек */
  onPlayFromOther: (trackId: string, albumId: string | undefined, paused: boolean) => void
  onPauseFromOther: () => void
  onResumeFromOther: () => void
  onNextFromOther: () => void
  onPrevFromOther: () => void
  onVolumeFromOther: (deviceId: string, volume: number) => void
}

interface RedirectInfo {
  host: string
  redirectTicket: string
  sessionId: number
  keepAliveSeconds?: number
}

type Status = 'idle' | 'connecting' | 'redirect' | 'sync' | 'error'

interface StatePayload {
  playerState?: {
    status?: { progressMs?: number; durationMs?: number; paused?: boolean; playbackSpeed?: number }
    playerQueue?: {
      currentPlayableIndex?: number
      playableList?: { playableId?: string; albumIdOptional?: string; title?: string }[]
      entityId?: string
    }
  }
  devices?: {
    deviceId?: string
    info?: { title?: string; type?: string }
    volumeInfo?: { volume?: number }
    capabilities?: { canBePlayer?: boolean; canBeRemoteController?: boolean }
  }[]
  activeDeviceId?: string
  timestampMs?: number
  rid?: string
}

function deviceInfoJson(deviceId: string): string {
  return JSON.stringify({
    'Ynison-Device-Id': deviceId,
    'Ynison-Device-Info': JSON.stringify({ app_name: DEFAULT_TITLE, type: '1' }),
  })
}

function subprotocol(deviceId: string, redirect?: RedirectInfo): string {
  const info: Record<string, string> = {
    'Ynison-Device-Id': deviceId,
    'Ynison-Device-Info': JSON.stringify({ app_name: DEFAULT_TITLE, type: '1' }),
  }
  if (redirect) {
    info['Ynison-Redirect-Ticket'] = redirect.redirectTicket
    info['Ynison-Session-Id'] = String(redirect.sessionId)
  }
  return encodeURIComponent(JSON.stringify(info))
}

export class YnisonClient {
  private token = ''
  private deviceId = ''
  private ws: WebSocket | null = null
  private syncTimer: number | null = null
  private reconnectTimer: number | null = null
  private reconnectAttempt = 0
  private stopped = false
  private remote: YnisonRemoteActions | null = null
  status: Status = 'idle'
  private lastPublish: unknown = null
  private listeners = new Set<(s: Status) => void>()

  isConnected(): boolean {
    return this.status === 'sync' && !!this.ws
  }

  /** id этого устройства в Ynison-сессии */
  getDeviceId(): string {
    return this.deviceId
  }

  onStatusChange(fn: (s: Status) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Подключить синхронизацию (token — OAuth-токен Яндекса) */
  connect(token: string, remote: YnisonRemoteActions): void {
    this.disconnect()
    this.token = token
    this.remote = remote
    this.stopped = false
    this.reconnectAttempt = 0
    this.makeDeviceId()
    void this.redirectAndConnect()
  }

  disconnect(): void {
    this.stopped = true
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.syncTimer) {
      window.clearInterval(this.syncTimer)
      this.syncTimer = null
    }
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
    this.ws = null
    this.lastPublish = null
    this.setStatus('idle')
  }

  private makeDeviceId(): void {
    const seed = 'ym-player-ynison:' + this.token
    // hex-хэш, как в исходниках (sha256 → первые 12 символов)
    let hash = 0
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
    this.deviceId = hash.toString(16).padStart(12, '0').slice(0, 12)
  }

  // ---------- шаг 1: редирект ----------
  private redirectAndConnect(): void {
    this.setStatus('redirect')
    let ws: WebSocket
    try {
      ws = new WebSocket(`${BASE_URL}/${REDIRECT_SERVICE}`, ['Bearer', 'v2', subprotocol(this.deviceId)])
    } catch {
      this.fail()
      return
    }
    this.ws = ws
    ws.onopen = () => {
      // ничего не отправляем — ждём первый фрейм от сервиса редиректа
    }
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as Record<string, unknown>
        const host = String(data.host ?? '')
        const ticket = String(data.redirect_ticket ?? '')
        const session = Number(data.session_id ?? data.sessionId ?? 0)
        if (!host || !ticket) throw new Error('Неполный ответ редиректа Ynison')
        const keepAlive = Number(
          (data.keep_alive_params as Record<string, unknown> | undefined)?.keep_alive_time_seconds ?? 0,
        )
        ws.close()
        this.openStateSocket({ host, redirectTicket: ticket, sessionId: session, keepAliveSeconds: keepAlive })
      } catch (e) {
        this.fail((e as Error).message)
      }
    }
    ws.onerror = () => this.fail('Ошибка подключения к редиректу Ynison')
    ws.onclose = () => {
      if (this.status === 'redirect' && !this.stopped) this.fail('Редирект Ynison закрыт')
    }
  }

  // ---------- шаг 2: state-сокет ----------
  private openStateSocket(redirect: RedirectInfo): void {
    if (this.stopped) return
    this.setStatus('connecting')
    let ws: WebSocket
    try {
      ws = new WebSocket(`wss://${redirect.host}/${STATE_SERVICE}`, [
        'Bearer',
        'v2',
        subprotocol(this.deviceId, redirect),
      ])
    } catch {
      this.fail('Нельзя открыть WebSocket')
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.setStatus('sync')
      this.reconnectAttempt = 0
      this.publishFullState()
      // keepalive: раз в ~15 с пере-публикуем последнее состояние
      const interval = redirect.keepAliveSeconds && redirect.keepAliveSeconds > 0 ? redirect.keepAliveSeconds * 1000 : 15000
      this.syncTimer = window.setInterval(() => {
        if (this.lastPublish && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(this.lastPublish))
        }
      }, Math.max(interval, 8000))
    }

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as StatePayload & { error?: unknown }
        if (data.error) {
          this.fail('Ошибка сервера Ynison: ' + JSON.stringify(data.error))
          return
        }
        this.handleRemote(data)
      } catch {
        /* бинарный/неожиданный фрейм — игнорируем */
      }
    }

    ws.onerror = () => this.fail('Ошибка WebSocket Ynison')
    ws.onclose = () => {
      if (this.syncTimer) {
        window.clearInterval(this.syncTimer)
        this.syncTimer = null
      }
      if (this.status === 'sync') this.scheduleReconnect()
      else if (!this.stopped) this.scheduleReconnect()
    }
  }

  // ---------- обработка команд других устройств ----------
  private handleRemote(data: StatePayload): void {
    if (!this.remote || !data.playerState) return
    const queue = data.playerState.playerQueue
    const status = data.playerState.status
    if (!queue || !status) return

    const idx = queue.currentPlayableIndex ?? -1
    const playable = queue.playableList?.[idx] ?? queue.playableList?.[0]

    // Другое устройство сменило трек
    if (playable?.playableId) {
      this.remote.onPlayFromOther(playable.playableId, playable.albumIdOptional, !!status.paused)
      return
    }
    // Пауза/продолжение
    if (status.paused) this.remote.onPauseFromOther()
    else this.remote.onResumeFromOther()
  }

  private fail(reason?: string): void {
    if (this.stopped) return
    this.setStatus('error')
    this.scheduleReconnect(reason)
  }

  private scheduleReconnect(reason?: string): void {
    if (this.stopped || this.reconnectTimer) return
    const delay = Math.min(30000, 3000 * Math.pow(2, this.reconnectAttempt++))
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      if (!this.stopped) this.redirectAndConnect()
    }, delay)
    void reason
  }

  // ---------- публикация состояния ----------
  private sendRequest(req: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const frame: Record<string, unknown> = {
      rid: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2),
      playerActionTimestampMs: Date.now(),
      activityInterceptionType: 'DO_NOT_INTERCEPT_BY_DEFAULT',
      ...req,
    }
    this.lastPublish = frame
    this.ws.send(JSON.stringify(frame))
  }

  /** Регистрация устройства как удалённого пульта (пустая очередь) */
  publishFullState(): void {
    this.sendRequest({
      updateFullState: {
        playerState: {
          playerQueue: {
            currentPlayableIndex: -1,
            options: { repeatMode: 'NONE' },
            version: { deviceId: this.deviceId },
            entityId: '',
            entityType: 'VARIOUS',
            entityContext: 'BASED_ON_ENTITY_BY_DEFAULT',
            fromOptional: '',
          },
          status: {
            paused: true,
            playbackSpeed: 1,
            version: { deviceId: this.deviceId, timestampMs: 0 },
          },
        },
        device: {
          capabilities: { canBePlayer: false, canBeRemoteController: true, volumeGranularity: 0 },
          info: { deviceId: this.deviceId, type: 'WEB', title: DEFAULT_TITLE, appName: 'ym-player' },
          volumeInfo: { volume: 0 },
        },
        isCurrentlyActive: false,
      },
    })
  }

  /** Пауза/продолжение (по нашему плееру) */
  publishPlayingStatus(input: { progressMs: number; durationMs: number; paused: boolean; playbackSpeed?: number }): void {
    this.sendRequest({
      updatePlayingStatus: {
        playingStatus: {
          progressMs: Math.floor(input.progressMs),
          durationMs: Math.floor(input.durationMs),
          paused: input.paused,
          playbackSpeed: input.playbackSpeed ?? 1,
          version: this.newVersion(),
        },
      },
    })
  }

  /** Сообщить о текущем треке/очереди */
  publishPlayerState(input: {
    currentPlayableIndex: number
    playableList: { playableId: string; albumIdOptional?: string; title?: string }[]
    entityId?: string
    playing: boolean
  }): void {
    this.sendRequest({
      updatePlayerState: {
        playerState: {
          playerQueue: {
            currentPlayableIndex: input.currentPlayableIndex,
            version: this.newVersion(),
            playableList: input.playableList,
            entityId: input.entityId ?? '',
            entityType: 'VARIOUS',
            entityContext: 'BASED_ON_ENTITY_BY_DEFAULT',
            fromOptional: '',
          },
          status: {
            progressMs: 0,
            durationMs: 0,
            paused: !input.playing,
            playbackSpeed: 1,
            version: this.newVersion(),
          },
        },
      },
    })
  }

  setVolume(deviceId: string, volume: number): void {
    this.sendRequest({
      updateVolumeInfo: {
        deviceId,
        volumeInfo: { volume: Math.max(0, Math.min(1, volume)), version: this.newVersion() },
      },
    })
  }

  private newVersion(): { deviceId: string; version: number; timestampMs: number } {
    return { deviceId: this.deviceId, version: Math.floor(Math.random() * 1e9) + 1, timestampMs: Date.now() }
  }

  private setStatus(s: Status): void {
    this.status = s
    this.listeners.forEach((fn) => fn(s))
  }
}

export const ynison = new YnisonClient()