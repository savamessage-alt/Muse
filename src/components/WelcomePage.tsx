import { useNavigate } from 'react-router-dom'
import { IconMusicNote } from './icons'

/** Экран-приветствие при первом запуске (токена нет) — отсюда идём во вход */
export default function WelcomePage() {
  const navigate = useNavigate()
  const goLogin = () => navigate('/login')

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-logo" aria-hidden>
          <div className="welcome-disc">
            <div className="welcome-disc-core">
              <IconMusicNote size={38} />
            </div>
          </div>
        </div>
        <h1 className="welcome-title">YM&nbsp;Player</h1>
        <p className="welcome-tag">
          Твоя музыка в тёмном стиле.
          <br />
          «Моя волна», лайки, плейлисты и тексты песен — как в Яндекс&nbsp;Музыке.
        </p>
        <button className="primary-btn welcome-cta" onClick={goLogin}>
          Войти в Яндекс&nbsp;Музыку
        </button>
        <button className="link-btn" onClick={goLogin}>
          У меня уже есть токен
        </button>
        <p className="hint welcome-hint">
          Вход займёт минуту: приложение покажет код, а вы подтвердите его на ya.ru/device.
        </p>
      </div>
    </div>
  )
}
