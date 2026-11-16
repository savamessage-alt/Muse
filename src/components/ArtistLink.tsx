// ============================================================
// ArtistLink — имя исполнителя как ссылка на страницу артиста.
// Клик не всплывает до родителя (в трек-строке родитель запускает
// воспроизведение), поэтому используем stopPropagation.
// ============================================================
import { useNavigate } from 'react-router-dom'
import type { MouseEvent } from 'react'
import type { ArtistBrief } from '../core/types'

interface Props {
  artists?: ArtistBrief[]
  /** запасной текст, если артистов нет */
  fallback?: string
  className?: string
  /** дополнительный title */
  title?: string
}

export function ArtistLink({ artists, fallback = '—', className = '', title }: Props) {
  const nav = useNavigate()
  if (!artists?.length) return <span className={className}>{fallback}</span>

  const go = (id: number) => (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    nav(`/artist/${id}`)
  }

  return (
    <span className={className} title={title ?? artists.map((a) => a.name).join(', ')}>
      {artists.map((a, i) => (
        <span key={`${a.id}-${i}`}>
          {i > 0 && <span className="artist-sep">, </span>}
          {a.id ? (
            <a
              className="artist-link"
              href={`#/artist/${a.id}`}
              onClick={go(a.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  e.preventDefault()
                  nav(`/artist/${a.id}`)
                }
              }}
              tabIndex={0}
              role="link"
            >
              {a.name}
            </a>
          ) : (
            <span>{a.name}</span>
          )}
        </span>
      ))}
    </span>
  )
}
