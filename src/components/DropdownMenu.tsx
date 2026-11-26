// Универсальное выпадающее меню.
// Рендерится в document.body через portal, поэтому его НЕ обрезают контейнеры
// с overflow (списки треков, шторки, панели). Позиция считается от кнопки-якоря,
// меню автоматически раскрывается вверх, если снизу мало места, и не вылезает
// за края экрана. Слой — var(--z-menu), выше всех панелей и шторок.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  /** кнопка, от которой отсчитывается позиция меню */
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
  minWidth?: number
  className?: string
}

export default function DropdownMenu({ open, anchor, onClose, children, minWidth = 180, className = '' }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean } | null>(null)

  const close = useCallback(() => onClose(), [onClose])

  // позиционирование: справа/слева от кнопки, с переворотом вверх у нижнего края
  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null)
      return
    }
    const measure = () => {
      const rect = anchor.getBoundingClientRect()
      const el = menuRef.current
      const mw = Math.max(el?.offsetWidth || minWidth, minWidth)
      const mh = el?.offsetHeight || 0
      const vw = window.innerWidth
      const vh = window.innerHeight
      const gap = 8
      const spaceBelow = vh - rect.bottom - gap
      const spaceAbove = rect.top - gap
      const up = mh > 0 && spaceBelow < mh && spaceAbove > spaceBelow
      const rawTop = up ? rect.top - mh - gap : rect.bottom + gap
      const top = Math.max(8, Math.min(rawTop, vh - mh - 8))
      const left = Math.max(8, Math.min(rect.right - mw, vw - mw - 8))
      setPos({ left, top, up })
    }
    measure()
    // повторный замер после отрисовки контента (высота становится точной)
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [open, anchor, minWidth])

  // закрытие: клик вне, Escape, скролл страницы, изменение размера
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t)) return
      if (anchor?.contains(t)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onScroll = (e: Event) => {
      // скролл внутри самого меню не закрывает
      if (menuRef.current?.contains(e.target as Node)) return
      close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open, anchor, close])

  if (!open) return null

  return createPortal(
    <div
      ref={menuRef}
      className={'dropdown-menu' + (pos?.up ? ' up' : '') + (className ? ' ' + className : '')}
      style={{
        left: pos ? pos.left : -9999,
        top: pos ? pos.top : -9999,
        minWidth,
        visibility: pos ? 'visible' : 'hidden',
      }}
      role="menu"
    >
      {children}
    </div>,
    document.body,
  )
}
