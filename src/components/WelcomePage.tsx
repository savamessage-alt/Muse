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
        <h1 className="welcome-title">Muse</h1>
        <p className="welcome-tag">
          Твоя музыка в тёмном стиле.
          <br />
          Волны, лайки, плейлисты и тексты песен — всё в одном месте.
        </p>
        <button className="primary-btn welcome-cta" onClick={goLogin}>
          Войти в аккаунт
        </button>
        <button className="link-btn" onClick={goLogin}>
          У меня уже есть токен
        </button>
        <p className="hint welcome-hint">
          Вход займёт минуту: приложение покажет код, а вы подтвердите его по ссылке на странице входа.
        </p>
      </div>
    </div>
  )
}
