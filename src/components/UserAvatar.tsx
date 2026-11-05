import { useMemo } from 'react'
import type { User } from '../core/types'
import { avatarGradient, userInitials } from '../core/format'

/**
 * Аватар пользователя.
 * API Яндекса не отдаёт фото аккаунта, поэтому рисуем фирменный
 * градиентный кружок с инициалами (вместо чужой картинки-заглушки).
 */
export default function UserAvatar({ user, large = false }: { user: User | null; large?: boolean }) {
  const name = user?.displayName ?? user?.fullName ?? user?.name ?? user?.login ?? ''
  const init = useMemo(() => userInitials(name), [name])
  const [c1, c2] = useMemo(() => avatarGradient(user?.login ?? user?.uid), [user?.login, user?.uid])

  return (
    <div
      className={'user-avatar inline' + (large ? ' large' : '')}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
      title={String(user?.login ?? user?.uid ?? '')}
      aria-label="Аватар пользователя"
    >
      {init}
    </div>
  )
}