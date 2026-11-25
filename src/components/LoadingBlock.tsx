// Единый индикатор загрузки: спиннер + подпись.
// Используется вместо повторяющихся блоков разметки на страницах.
type Props = {
  /** что именно загружается — уходит в aria-label */
  label: string
  /** текст под спиннером */
  text?: string
  className?: string
}

export default function LoadingBlock({ label, text = 'Загружаем…', className }: Props) {
  return (
    <div className={'list-loading' + (className ? ' ' + className : '')} role="status" aria-label={label}>
      <div className="spinner" />
      <span className="muted small">{text}</span>
    </div>
  )
}
