// ============================================================
// Свайповое управление на всех страницах:
//  • горизонтальный свайп по контенту — переключение корневых вкладок
//  • свайп от левого края — «назад»
//  • умная блокировка оси: вертикальный скролл не превращается в свайп
// ============================================================

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Корневые вкладки в порядке переключения свайпом */
const TABS = ['/', '/search', '/radio', '/likes', '/history', '/settings'] as const

const EDGE_PX = 34 // зона старта у левого края («назад»)
const MIN_DX = 70 // минимальная длина горизонтального свайпа
const MAX_MS = 800 // максимальная длительность жеста
const AXIS_LOCK = 1.2 // насколько горизонталь должна доминировать над вертикалью

/** Элементы, на которых свайп по странице не должен перехватываться */
const IGNORE_SELECTOR = [
  '.range', // слайдеры перемотки/громкости
  '.queue-row', // строки очереди (свой свайп-удаление)
  '.lyrics-text', // выделение текста песни
  '.psheet', // развёрнутый плеер — там свои жесты
  '.pb-lyrics', // панель текста
  '.toast', // тосты
].join(',')

function isEditable(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable === true
  )
}

export function useSwipeNav(): void {
  const navigate = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    let startX = 0
    let startY = 0
    let startT = 0
    let armed = false
    let fromEdge = false

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const target = e.target as Element | null
      if (isEditable(target)) return
      if (target?.closest(IGNORE_SELECTOR)) return
      startX = e.clientX
      startY = e.clientY
      startT = Date.now()
      fromEdge = e.clientX <= EDGE_PX
      armed = true
    }

    const onUp = (e: PointerEvent) => {
      if (!armed) return
      armed = false
      if (Date.now() - startT > MAX_MS) return

      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)

      // свайп от левого края → назад (работает и на корневых вкладках)
      if (fromEdge) {
        if (dx > MIN_DX && absX > absY * AXIS_LOCK) {
          const idx = TABS.indexOf(loc.pathname as (typeof TABS)[number])
          if (idx > 0) navigate(TABS[idx - 1])
          else if (idx === 0) navigate('/')
          else navigate(-1)
          return
        }
        if (dx < -MIN_DX && absX > absY * AXIS_LOCK) navigate(-1)
        return
      }

      // горизонтальный свайп по контенту → переключение вкладок
      if (absX < MIN_DX || absX < absY * AXIS_LOCK) return
      const idx = TABS.indexOf(loc.pathname as (typeof TABS)[number])
      if (idx === -1) {
        // мы на вложенной странице (артист/альбом/плейлист) — свайп вправо = назад
        if (dx > 0) navigate(-1)
        return
      }
      if (dx < 0) {
        // влево — следующая вкладка
        navigate(TABS[Math.min(idx + 1, TABS.length - 1)])
      } else {
        // вправо — предыдущая вкладка
        navigate(TABS[Math.max(idx - 1, 0)])
      }
    }

    const onCancel = () => {
      armed = false
    }

    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onCancel, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [navigate, loc.pathname])
}
