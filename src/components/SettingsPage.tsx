import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/store'
import { tokenManager } from '../core/tokenManager'
import { player } from '../core/player'
import UserAvatar from './UserAvatar'
import { IconInfo } from './icons'
import { getTheme, setTheme, type Theme } from '../core/theme'

export default function SettingsPage() {
  const user = useApp((s) => s.user)
  const status = useApp((s) => s.status)
  const logout = useApp((s) => s.logout)
  const navigate = useNavigate()
  const showToast = useApp((s) => s.showToast)

  const token = tokenManager.getToken()
  const [quality, setQuality] = useState(() => localStorage.getItem('ym.quality') ?? 'mp3-320')
  const [refreshingToken, setRefreshingToken] = useState(false)
  const [cacheBusy, setCacheBusy] = useState(false)
  const [cacheLabel, setCacheLabel] = useState('0 МБ')
  const [theme, setThemeState] = useState(() => getTheme())

  const setThemeLocal = (t: Theme) => {
    setTheme(t)
    setThemeState(t)
  }

  const fmtSize = (b: number) => (b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + ' МБ' : Math.round(b / 1024) + ' КБ')

  const refreshCacheSize = async () => {
    setCacheBusy(true)
    try {
      const { cacheSize } = await import('../core/offlineCache')
      setCacheLabel(fmtSize(await cacheSize()))
    } catch {
      setCacheLabel('—')
    } finally {
      setCacheBusy(false)
    }
  }

  const clearOfflineCache = async () => {
    setCacheBusy(true)
    try {
      const { clearCache } = await import('../core/offlineCache')
      await clearCache()
      setCacheLabel('0 МБ')
      showToast('Офлайн-кэш очищен', 'success')
    } catch (e) {
      showToast('Не удалось очистить кэш: ' + (e as Error).message, 'error')
    } finally {
      setCacheBusy(false)
    }
  }

  useEffect(() => {
    void refreshCacheSize()
  }, [])

  const setQualityLocal = (q: string) => {
    localStorage.setItem('ym.quality', q)
    setQuality(q)
    void player.reloadCurrent()
    showToast('Качество сохранено' + (player.snapshot().current ? ' — текущий трек перезапущен' : ''))
  }

  const refreshNow = async () => {
    if (refreshingToken) return
    setRefreshingToken(true)
    try {
      await tokenManager.getAccessToken(true)
      showToast('Токен обновлён')
    } catch (e) {
      showToast('Не удалось обновить токен: ' + (e as Error).message, 'error')
    } finally {
      setRefreshingToken(false)
    }
  }

  const sub = status?.subscription
  const hasPlus = !!status?.plus?.hasPlus || !!status?.account?.hasPlus || (!!sub && !sub.expired)

  return (
    <div>
      <h1 className="page-title">Настройки</h1>

      <section className="settings-card">
        <h2>Аккаунт</h2>
        <div className="settings-row">
          <UserAvatar user={user} large />
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
          <button className="btn" onClick={() => void refreshNow()} disabled={refreshingToken}>
            {refreshingToken ? 'Обновляем…' : 'Обновить токен сейчас'}
          </button>
          <button className="btn danger" onClick={logout}>
            Выйти из аккаунта
          </button>
        </div>
        <p className="hint">Access-токен живёт ограниченное время. При истечении плеер автоматически обновляет его по refresh-токену; если это не удалось — появится экран повторного входа.</p>
      </section>

      <section className="settings-card">
        <h2>Тема оформления</h2>
        {(
          [
            ['dark', 'Тёмная'],
            ['light', 'Светлая'],
          ] as const
        ).map(([val, label]) => (
          <label key={val} className="radio-row">
            <input
              type="radio"
              name="theme"
              checked={theme === val}
              onChange={() => setThemeLocal(val)}
            />
            <span>{label}</span>
          </label>
        ))}
        <p className="hint">Смена темы применяется сразу ко всему интерфейсу.</p>
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
        <h2>Офлайн-кэш</h2>
        <p className="hint">
          Скачанные треки («Скачать для офлайна» в меню трека) доступны без интернета.
          Кэш ограничен 500 МБ — старые записи удаляются автоматически.
        </p>
        <div className="settings-actions">
          <button className="btn" onClick={() => void refreshCacheSize()} disabled={cacheBusy}>
            {cacheBusy ? 'Считаем…' : `Занято: ${cacheLabel}`}
          </button>
          <button className="btn danger" onClick={() => void clearOfflineCache()} disabled={cacheBusy}>
            Очистить кэш
          </button>
        </div>
      </section>

      <section className="settings-card">
        <h2>О приложении</h2>
        <div className="settings-actions">
          <button className="btn primary" onClick={() => navigate('/about')}>
            <IconInfo size={16} fill="currentColor" /> О Muse
          </button>
        </div>
      </section>
    </div>
  )
}
