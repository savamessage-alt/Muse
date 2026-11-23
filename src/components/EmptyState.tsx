// Универсальное пустое состояние: иконка + заголовок + описание + кнопка действия
import { useNavigate } from 'react-router-dom'

type Props = {
  icon: React.ReactNode
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction, className }: Props) {
  const nav = useNavigate()
  return (
    <div className={'empty-state ' + (className ?? '')}>
      <div className="empty-icon">{icon}</div>
      <h2 className="empty-title">{title}</h2>
      {subtitle && <p className="empty-sub">{subtitle}</p>}
      {actionLabel && onAction && (
        <button className="btn" onClick={() => void onAction()}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
