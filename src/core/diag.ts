// ============================================================
// Диагностическая телеметрия (dev): шлёт состояние токена на
// dev-сервер (POST /__diag), чтобы разработчик видел причину
// «не пускает в плеер» с другого компьютера/браузера.
// В проде (без dev-сервера) запрос просто молча падает.
// ============================================================

import type { StoredToken } from './tokenManager'

function sanitize(token: StoredToken | null): Record<string, unknown> | null {
  if (!token) return null
  return {
    exp: token.expiresAt,
    hasRefresh: !!token.refreshToken,
    tokenLen: token.accessToken ? token.accessToken.length : 0,
    prefix: token.accessToken ? token.accessToken.slice(0, 6) : '',
  }
}

export function diag(fact: string, token: StoredToken | null): void {
  try {
    const payload = JSON.stringify({
      fact,
      href: location.href,
      ua: navigator.userAgent.slice(0, 120),
      token: sanitize(token),
      t: Date.now(),
    })
    void fetch('/__diag', { method: 'POST', body: payload }).catch(() => {})
  } catch {
    /* не критично */
  }
}