import { useEffect, useState } from 'react'
import { useApp } from '../state/store'
import { tokenManager } from '../core/tokenManager'
import { player } from '../core/player'
import { ymClient } from '../core/client'
import { ymFetch, YM_CLIENT_HEADER, type YmRequestInit, ymFetchXml } from '../core/transport'
import { buildUrlFromXml } from '../core/stream'
import { coverUrl, PLACEHOLDER_COVER } from '../core/format'
import YnisonPanel from './YnisonPanel'

export default function SettingsPage() {
  const user = useApp((s) => s.user)
  const status = useApp((s) => s.status)
  const logout = useApp((s) => s.logout)
  const showToast = useApp((s) => s.showToast)

  const token = tokenManager.getToken()
  const [quality, setQuality] = useState(() => localStorage.getItem('ym.quality') ?? 'mp3-320')
  const [diag, setDiag] = useState('')

  const runDiag = async () => {
    setDiag('—— проверяем……')
    const lines: string[] = []
    const raw = async (name: string, url: string, opts: YmRequestInit = {}) => {
      try {
        const data = await ymFetch(url, opts)
        lines.push(`── ${name} ──\n` + JSON.stringify(data).slice(0, 700))
      } catch (e) {
        lines.push(`── ${name} ОШИБКА ──\n` + String((e as Error)?.message ?? e).slice(0, 300))
      }
    }
    const tok = await tokenManager.getAccessToken().catch(() => '')
    const authHeaders = { Authorization: `OAuth ${tok}`, 'X-Yandex-Music-Client': YM_CLIENT_HEADER }
    await raw('/api/me', '/api/me', { headers: authHeaders })
    await raw('/api/account/status', '/api/account/status', { headers: authHeaders })
    let uidText = 'me'
    try {
      const uid = await ymClient.getUid()
      if (uid) uidText = String(uid)
    } catch {
      /* uid недоступен */
    }
    await raw(`/api/users/${uidText}/playlists/list`, `/api/users/${uidText}/playlists/list`, { headers: authHeaders })
    await raw('/api/search queen', '/api/search?text=queen&type=all&page=0&nocorrect=false&playlist-in-best=true', {
      headers: authHeaders,
    })
    let trackId = ''
    // Плейлист «Премьера» (kind 185329333) приходит в ленте — берём из него первый трек
    try {
      const pl = (await ymFetch('/api/users/692529388/playlists/185329333?withTracks=true', {
        headers: authHeaders,
      })) as { result?: { tracks?: unknown } }
      const res = pl?.result ?? {}
      lines.push('── Премьера: ' + JSON.stringify(res).slice(0, 250))
      const arr = Array.isArray(res) ? res : (res as { tracks?: unknown }).tracks
      const t0 = Array.isArray(arr) ? (arr as { id?: string | number }[])[0] : null
      if (t0?.id) trackId = String(t0.id)
      lines.push('── первый трек: ' + JSON.stringify(t0 ?? null).slice(0, 400))
    } catch (e) {
      lines.push('── плейлист не загрузился: ' + String((e as Error)?.message ?? e).slice(0, 150))
    }
    if (trackId) {
      const di = (await ymFetch<{ result?: { download_info_url?: string }[] }>(
        `/api/tracks/${trackId}/download-info`,
        { headers: authHeaders },
      ).catch(() => null)) as unknown
      const rawItems = ((di as { result?: unknown[] } | null)?.result ?? []) as Record<string, unknown>[]
      lines.push(`── download-info вариантов: ${rawItems.length}; первый: ` + JSON.stringify(rawItems[0] ?? {}).slice(0, 220))
      const diUrl = (rawItems[0]?.download_info_url ?? rawItems[0]?.downloadInfoUrl) as string | undefined
      if (diUrl) {
        try {
          const xml = await ymFetchXml(diUrl)
          lines.push('── XML получен (' + String(xml).length + ' симв.): ' + String(xml).slice(0, 260))
          const built = buildUrlFromXml(xml)
          lines.push('── ГОТОВАЯ ССЫЛКА: ' + (built ?? 'НЕ УДАЛОСЬ ПОСТРОИТЬ'))
          if (built) {
            try {
              // обычный fetch — служебный помощник dev-сервера (/__probe), не через API-транспорт
              const pr = (await fetch('/__probe?u=' + encodeURIComponent(built)).then((r) => r.json())) as {
                status?: number
                contentType?: string
                contentRange?: string
                head?: string
                error?: string
              }
              lines.push(
                '── ПРОВЕРКА ССЫЛКИ: HTTP ' +
                  (pr.status ?? '?') +
                  ' · тип: ' +
                  (pr.contentType ?? '?') +
                  ' · range: ' +
                  (pr.contentRange ?? '-') +
                  (pr.head ? ' · начало: ' + pr.head.slice(0, 60) : '') +
                  (pr.error ? ' · ошибка: ' + pr.error : ''),
              )
            } catch (e) {
              lines.push('── ПРОВЕРКА ССЫЛКИ ошибка: ' + String((e as Error)?.message ?? e).slice(0, 150))
            }
          }
        } catch (e) {
          lines.push('── XML ошибка: ' + String((e as Error)?.message ?? e).slice(0, 160))
        }
      } else {
        lines.push('── download_info_url отсутствует в ответе!')
      }
      lines.push(`── трек для пробы: ${trackId} ──`)
    } else {
      lines.push('── трек для download-info не найден ──')
    }
    await raw('/api/feed', '/api/feed', { headers: authHeaders })
    try {
      const m = await ymClient.me()
      lines.push('── me() через клиент ──\n' + JSON.stringify(m).slice(0, 400))
    } catch (e) {
      lines.push('── me() через клиент ОШИБКА ──\n' + String((e as Error)?.message ?? e).slice(0, 200))
    }
    setDiag(lines.join('\n\n'))
  }

  const setQualityLocal = (q: string) => {
    localStorage.setItem('ym.quality', q)
    setQuality(q)
    void player.reloadCurrent()
    showToast('Качество сохранено' + (player.snapshot().current ? ' — текущий трек перезапущен' : ''))
  }

  const refreshNow = async () => {
    try {
      await tokenManager.getAccessToken(true)
      showToast('Токен обновлён')
    } catch (e) {
      showToast('Не удалось обновить токен: ' + (e as Error).message, 'error')
    }
  }

  const sub = status?.subscription
  const hasPlus = !!status?.plus?.hasPlus || !!status?.account?.hasPlus || !sub?.expired

  return (
    <div>
      <h1 className="page-title">Настройки</h1>

      <section className="settings-card">
        <h2>Аккаунт</h2>
        <div className="settings-row">
          <img
            className="user-avatar large"
            src={coverUrl(user?.coverUri, '120x120') ?? PLACEHOLDER_COVER}
            alt=""
            onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
          />
          <div>
            <div className="settings-name">{user?.displayName ?? user?.login ?? '—'}</div>
            <div className="muted small">Логин: {user?.login ?? '—'} · UID: {user?.uid ?? '—'}</div>
            <div className="muted small">Регион API: {status?.account?.region ?? status?.region ?? '—'}</div>
          </div>
          <span className={'badge' + (hasPlus ? ' plus' : '')}>{hasPlus ? 'С подпиской' : 'Без подписки'}</span>
        </div>
        {sub && (
          <div className="muted small">
            Подписка: {(sub.product?.productId ?? sub.productId ?? '—')}
            {sub.end ? ' · действует до ' + new Date(sub.end).toLocaleDateString('ru-RU') : ''}
          </div>
        )}
      </section>

      <section className="settings-card">
        <h2>Токен и авторизация</h2>
        <div className="muted small">
          {token?.accessToken ? (
            <>
              Токен сохранён
              {token.expiresAt
                ? ' · истекает: ' + new Date(token.expiresAt).toLocaleString('ru-RU')
                : ' (без срока)'}
              {tokenManager.isExpiringSoon() && ' · скоро обновится автоматически'}
            </>
          ) : (
            'Токен не найден'
          )}
        </div>
        <div className="settings-actions">
          <button className="btn" onClick={() => void refreshNow()}>
            Обновить токен сейчас
          </button>
          <button className="btn danger" onClick={logout}>
            Выйти из аккаунта
          </button>
        </div>
        <p className="hint">Access-токен живёт ограниченное время. При истечении плеер автоматически обновляет его по refresh-токену; если это не удалось — появится экран повторного входа.</p>
      </section>

      <section className="settings-card">
        <h2>Качество воспроизведения</h2>
        {(
          [
            ['mp3-320', 'MP3 320 кбит/с (максимум, рекомендуется)'],
            ['mp3-192', 'MP3 192 кбит/с'],
            ['mp3-128', 'MP3 128 кбит/с (экономия трафика)'],
          ] as const
        ).map(([val, label]) => (
          <label key={val} className="radio-row">
            <input
              type="radio"
              name="quality"
              checked={quality === val}
              onChange={() => setQualityLocal(val)}
            />
            <span>{label}</span>
          </label>
        ))}
        <p className="hint">Изменение применится к новому треку; текущий трек будет перезапущен в новом качестве.</p>
      </section>

      <section className="settings-card">
        <h2>Синхронизация устройств (Ynison)</h2>
        <YnisonPanel />
      </section>

      <section className="settings-card">
        <h2>Диагностика API</h2>
        <p className="hint">Если аккаунт не загрузился — нажмите кнопку и пришлите текст ниже разработчику.</p>
        <div className="settings-actions">
          <button className="btn" onClick={() => void runDiag()}>
            Проверить API
          </button>
        </div>
        {diag && (
          <pre
            className="diag-pre"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12, maxHeight: 260, overflowY: 'auto' }}
          >
            {diag}
          </pre>
        )}
      </section>

      <section className="settings-card">
        <h2>Об приложении</h2>
        <p className="muted small">
          Muse — музыкальный плеер. Интерфейс на русском.
          Сборки: веб → Windows (.exe, Electron) → Android (.apk, Capacitor).
        </p>
      </section>
    </div>
  )
}