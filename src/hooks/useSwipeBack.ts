// ============================================================
// Свайп «назад» от левого края экрана — стандартный жест Android
// (gesture navigation) и iOS. Работает на всех страницах приложения.
// ============================================================

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Корневые вкладки: с них «назад» некуда — свайп игнорируется */
const ROOT_PATHS = ['/', '/search', '/radio', '/likes', '/history', '/settings', '/playlists']

const EDGE_PX = 34 // зона старта у левого края
const MIN_DX = 90 // минимальная длина свайпа
const MAX_MS = 700 // максимальная длительность

export function useSwipeBack(): void {
  const navigate = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    let sx = 0
    let sy = 0
    let st = 0
    let armed = false

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (e.clientX > EDGE_PX) return
      sx = e.clientX
      sy = e.clientY
      st = Date.now()
      armed = true
    }

    const onUp = (e: PointerEvent) => {
      if (!armed) return
      armed = false
      const dx = e.clientX - sx
      const dy = e.clientY - sy
      if (Date.now() - st > MAX_MS) return
      if (dx < MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (ROOT_PATHS.includes(loc.pathname)) return
      navigate(-1)
    }

    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [navigate, loc.pathname])
}