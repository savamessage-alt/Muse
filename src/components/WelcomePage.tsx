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
              <IconMusicNote size={40} />
            </div>
          </div>
        </div>
        <h1 className="welcome-title">Muse</h1>
        <p className="welcome-tag">Волна, лайки, плейлисты и тексты песен.</p>

        <button className="primary-btn cta-gradient welcome-cta" onClick={goLogin}>
          Войти в аккаунт
        </button>
        <button className="link-btn" onClick={goLogin}>
          У меня уже есть токен
        </button>

        <div className="welcome-legal">
          <a
            href="https://yandex.ru/legal/termsofuse/"
            target="_blank"
            rel="noopener noreferrer"
            className="legal-link"
          >
            Условия использования
          </a>
          <span className="legal-sep">·</span>
          <a
            href="https://yandex.ru/legal/confidential/"
            target="_blank"
            rel="noopener noreferrer"
            className="legal-link"
          >
            Конфиденциальность
          </a>
        </div>
      </div>
    </div>
  )
}
