import { useEffect, useRef, useState } from 'react'
import { ynison, type YnisonRemoteActions } from '../core/ynison'
import { player } from '../core/player'
import { tokenManager } from '../core/tokenManager'
import { ymClient } from '../core/client'

const STATUS_TEXT: Record<string, string> = {
  idle: 'Выключена',
  redirect: 'Получение адреса Ynison…',
  connecting: 'Подключение…',
  sync: 'Подключена',
  error: 'Ошибка',
}

const remoteActions: YnisonRemoteActions = {
  onPlayFromOther: (trackId, albumId, paused) => {
    void (async () => {
      try {
        const [track] = await ymClient.tracks([`${trackId}${albumId ? ':' + albumId : ''}`])
        if (!track) return
        await player.playTrack(track, 'queue')
        if (paused) player.pause()
      } catch {
        /* не удалось воспроизвести трек с другого устройства */
      }
    })()
  },
  onPauseFromOther: () => player.pause(),
  onResumeFromOther: () => player.resume(),
  onNextFromOther: () => void player.next(),
  onPrevFromOther: () => void player.prev(),
  onVolumeFromOther: (deviceId, volume) => {
    if (deviceId === ynison.getDeviceId()) player.setVolume(volume)
  },
}

export default function YnisonPanel() {
  const [status, setStatus] = useState<string>(ynison.status)
  const [deviceId, setDeviceId] = useState('')
  const lastTrackId = useRef('')
  const lastSecond = useRef(-1)
  const lastPlaying = useRef(false)

  useEffect(() => {
    return ynison.onStatusChange((s) => {
      setStatus(s)
      if (s === 'sync') setDeviceId(ynison.getDeviceId())
    })
  }, [])

  // Когда синхронизация активна — публикуем состояние плеера
  useEffect(() => {
    if (status !== 'sync') return
    return player.onChange((snap) => {
      const cur = snap.current?.track
      if (!cur) return

      // смена трека → публикуем очередь/текущий индекс
      if (cur.id !== lastTrackId.current) {
        lastTrackId.current = cur.id
        ynison.publishPlayerState({
          currentPlayableIndex: snap.index,
          entityId: '',
          playing: snap.playing,
          playableList: snap.queue.map((q) => ({
            playableId: q.track.id,
            albumIdOptional: q.track.albums?.[0]?.id,
            title: q.track.title,
          })),
        })
      }

      // прогресс/пауза — не чаще раза в секунду
      const sec = Math.floor(snap.positionMs / 1000)
      if (sec !== lastSecond.current || snap.playing !== lastPlaying.current) {
        lastSecond.current = sec
        lastPlaying.current = snap.playing
        ynison.publishPlayingStatus({
          progressMs: snap.positionMs,
          durationMs: snap.durationMs,
          paused: !snap.playing,
        })
      }
    })
  }, [status])

  const connect = () => {
    const token = tokenManager.getToken()?.accessToken
    if (!token) return
    ynison.connect(token, remoteActions)
  }

  const connected = ynison.isConnected() || status === 'connecting' || status === 'redirect'

  return (
    <div className="ynison-panel">
      <div className="muted small">
        Статус: <b>{STATUS_TEXT[status] ?? status}</b>
        {deviceId && <span> · устройство: <code>{deviceId}</code></span>}
      </div>
      <div className="settings-actions">
        {!connected ? (
          <button className="btn" onClick={connect}>Подключить синхронизацию</button>
        ) : (
          <button className="btn danger" onClick={() => ynison.disconnect()}>Отключить</button>
        )}
      </div>
      <p className="hint">
        Когда синхронизация включена, другие устройства (телефон, колонка) видят
        ваш текущий трек и могут управлять воспроизведением (пауза, переключение), и наоборот.
      </p>
    </div>
  )
}