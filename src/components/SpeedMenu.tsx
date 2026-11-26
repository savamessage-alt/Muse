// Кнопка скорости воспроизведения («1×») с выпадающим меню.
// Заменяет нативный <select>, который на Android выглядит сломанным.
import { useState } from 'react'
import DropdownMenu from './DropdownMenu'
import { IconCheck } from './icons'

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

export default function SpeedMenu({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className={'speed-btn' + (value !== 1 ? ' active' : '')}
        onClick={(e) => {
          setAnchor(e.currentTarget)
          setOpen((v) => !v)
        }}
        title="Скорость воспроизведения"
        aria-label={`Скорость ${value}×`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {value}×
      </button>
      <DropdownMenu open={open} anchor={anchor} onClose={() => setOpen(false)} minWidth={124} className="dropdown-compact">
        <div className="dropdown-title">Скорость</div>
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={'dropdown-item' + (s === value ? ' selected' : '')}
            role="menuitemradio"
            aria-checked={s === value}
            onClick={() => {
              onChange(s)
              setOpen(false)
            }}
          >
            <span className="dropdown-item-name">{s}×</span>
            {s === value && <IconCheck size={14} />}
          </button>
        ))}
      </DropdownMenu>
    </>
  )
}
