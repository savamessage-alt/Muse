import { useApp } from '../state/store'
import { IconX } from './icons'

export default function Toasts() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  if (!toasts.length) return null
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span>{t.text}</span>
          <button className="icon-btn small" onClick={() => dismiss(t.id)} aria-label="Закрыть">
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}