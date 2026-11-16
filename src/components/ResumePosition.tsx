// «Продолжить с того же места» — сохраняем позицию трека и восстанавливаем при старте (как в Яндекс Музыке)
import { useEffect, useRef } from 'react'
import { player } from '../core/player'
import { ymClient } from '../core/client'
import { useApp } from '../state/store'

const LS_KEY = 'ym.resume'

// Module-level flag to prevent multiple resume attempts across StrictMode mounts
let hasResumed = false

export default function ResumePosition() {
  const restored = useRef(false)
  const showToast = useApp((s) => s.showToast)

  // ---------- сохранение позиции ----------
  useEffect(() => {
    let last = 0
    const save = () => {
      const s = player.snapshot()
      const cur = s.current
      if (!cur) return
      if (s.positionMs < 3000) return
      if (s.durationMs > 0 && s.positionMs > s.durationMs - 5000) return // трек почти закончился
      const now = Date.now()
      if (now - last < 3000) return
      last = now
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({
            id: cur.track.id,
            albumId: cur.track.albums?.[0]?.id ?? '',
            posMs: Math.round(s.positionMs),
            ts: now,
          }),
        )
      } catch {
        /* localStorage недоступен — не критично */
      }
    }
    const iv = setInterval(save, 3000)
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', save)
    return () => {
      clearInterval(iv)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', save)
    }
  }, [])

  // ---------- восстановление (один раз при старте) ----------
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    if (hasResumed) return
    if (player.snapshot().queue.length > 0) return // уже что-то играет
    let rec: { id: string; albumId?: string; posMs?: number; ts?: number } | null = null
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) rec = JSON.parse(raw)
    } catch {
      return
    }
    if (!rec?.id) return
    if (!rec.ts || Date.now() - rec.ts > 48 * 3600 * 1000) {
      localStorage.removeItem(LS_KEY)
      return
    }
    const key = rec.albumId ? `${rec.id}:${rec.albumId}` : rec.id
    const pos = rec.posMs ?? 0
    hasResumed = true
    void (async () => {
      try {
        const [t] = await ymClient.tracks([key])
        if (!t) return
        await player.playQueue([{ track: t, source: 'queue' }], 0)
        if (pos >= 3000) {
          let tries = 0
          const iv = setInterval(() => {
            const s = player.snapshot()
            if (s.durationMs > 0) {
              clearInterval(iv)
              player.seek(Math.min(pos, Math.max(s.durationMs - 2000, 0)))
              return
            }
            if (++tries > 60) clearInterval(iv)
          }, 300)
        }
        showToast('⏯ Продолжили с того места, где остановились')
      } catch {
        /* нет токена или сети — просто молчим */
      }
    })()
  }, [showToast])

  return null
}