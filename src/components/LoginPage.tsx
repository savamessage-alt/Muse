import { useEffect, useState } from 'react'
import { requestDeviceCode, pollDeviceToken, type DeviceCodeData } from '../core/auth'
import { tokenManager } from '../core/tokenManager'
import { useApp } from '../state/store'
import { IconExternal, IconRefresh } from './icons'

type Step = 'idle' | 'waiting' | 'done'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('idle')
  const [code, setCode] = useState<DeviceCodeData | null>(null)
  const [statusText, setStatusText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [showManual, setShowManual] = useState(false)

  const start = async () => {
    setErr(null)
    setStatusText('Получаем код входа…')
    try {
      const c = await requestDeviceCode()
      setCode(c)
      setStep('waiting')
    } catch (e) {
      setErr('Не удалось получить код: ' + (e as Error).message)
    }
  }

  const openPage = () => {
    if (code) window.open(code.verificationUrl, '_blank', 'noopener')
  }

  useEffect(() => {
    if (step !== 'waiting' || !code) return
    let alive = true
    setStatusText('Ожидаем подтверждения входа…')
    pollDeviceToken(
      code.deviceCode,
      code.interval,
      code.expiresIn,
      (poll) => {
        if (alive && poll !== 'authorization_pending') setStatusText('Ожидаем подтверждения… (' + poll + ')')
      },
    )
      .then(async (tok) => {
        if (!alive) return
        tokenManager.save(tok)
        setStep('done')
        await useApp.getState().boot()
      })
      .catch((e) => {
        if (!alive) return
        setErr((e as Error).message)
        setStep('idle')
        setCode(null)
      })
    return () => {
      alive = false
    }
  }, [step, code])

  const saveManual = () => {
    const t = manual.trim()
    if (!t) return
    tokenManager.save({ accessToken: t, expiresIn: 0 })
    void useApp.getState().boot()
  }

  if (step === 'done') {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Готово!</h1>
          <p>Токен сохранён. Открываем ваш плеер…</p>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-dot" /> Yandex&nbsp;Music&nbsp;Player
        </div>
        <h1>Вход через Яндекс</h1>
        <p className="muted">
          Плеер работает с вашим аккаунтом Яндекс&nbsp;Музыки. Токен истекает — приложение
          автоматически обновляет его по refresh-токену, а если это не удалось — вы просто войдёте ещё раз.
        </p>

        {step === 'idle' && (
          <>
            <button className="primary-btn" onClick={() => void start()}>
              Войти через Яндекс
            </button>
            <button className="link-btn" onClick={() => setShowManual((v) => !v)}>
              {showManual ? 'Скрыть ручной ввод' : 'У меня уже есть токен'}
            </button>
            {showManual && (
              <div className="manual-box">
                <input
                  className="input"
                  placeholder="Вставьте токен (access_token)"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                />
                <button className="primary-btn small" onClick={saveManual}>
                  Сохранить
                </button>
              </div>
            )}
          </>
        )}

        {step === 'waiting' && code && (
          <div className="code-box">
            <div className="code-display">{code.userCode}</div>
            <p className="muted">Откройте страницу и введите код (откройте ссылку кнопкой):</p>
            <div className="code-url">
              <span>{code.verificationUrl}</span>
              <button className="icon-btn" onClick={openPage} title="Открыть страницу входа на Яндексе">
                <IconExternal />
              </button>
            </div>
            <p className="status-text">{statusText}</p>
            <div className="spinner" />
          </div>
        )}

        {err && (
          <div className="error-box">
            <p>{err}</p>
            <button className="icon-btn" onClick={() => void start()} title="Попробовать снова">
              <IconRefresh />
            </button>
          </div>
        )}

        <p className="hint">
          Нет аккаунта с подпиской? Часть треков будет недоступна — статус покажем на странице
          настроек после входа.
        </p>
      </div>
    </div>
  )
}