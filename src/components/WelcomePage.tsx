import { useNavigate } from 'react-router-dom'
import { IconMusicNote, IconZap, IconHeart, IconPlay, IconList, IconMoon, IconSliders, IconExternal } from './icons'

/** Экран-приветствие при первом запуске (токена нет) — отсюда идём во вход */
export default function WelcomePage() {
  const navigate = useNavigate()
  const goLogin = () => navigate('/login')

  const features = [
    { icon: <IconZap size={20} fill="currentColor" />, title: 'Моя волна', desc: 'Персональные рекомендации под ваш вкус' },
    { icon: <IconHeart size={20} fill="currentColor" />, title: 'Лайки и избранное', desc: 'Собирайте понравившиеся треки в одну коллекцию' },
    { icon: <IconPlay size={20} fill="currentColor" />, title: 'Плейлисты и радио', desc: 'Станции, чарты и собственные подборки' },
    { icon: <IconList size={20} fill="currentColor" />, title: 'Тексты песен', desc: 'Пойте вместе с любимыми исполнителями' },
    { icon: <IconMoon size={20} fill="currentColor" />, title: 'Таймер сна', desc: 'Автостоп воспроизведения через заданное время' },
    { icon: <IconSliders size={20} fill="currentColor" />, title: 'Редактор плейлистов', desc: 'Создавайте и редактируйте свои подборки' },
    { icon: <IconMusicNote size={20} fill="currentColor" />, title: 'Похожие треки', desc: 'Открывайте новую музыку по вкусу' },
  ]

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
        <p className="welcome-tag">
          Твоя музыка в тёмном стиле.<br />
          Волны, лайки, плейлисты и тексты песен — всё в одном месте.
        </p>

        <div className="welcome-features">
          {features.map((f, i) => (
            <div key={i} className="welcome-feature">
              <div className="welcome-feature-icon">{f.icon}</div>
              <div className="welcome-feature-text">
                <div className="welcome-feature-title">{f.title}</div>
                <div className="welcome-feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <button className="primary-btn cta-gradient welcome-cta" onClick={goLogin}>
          Авторизоваться
        </button>
        <button className="link-btn" onClick={goLogin}>
          У меня уже есть токен
        </button>
        <p className="hint welcome-hint">
          Вход займёт минуту: приложение покажет код, а вы подтвердите его по ссылке на странице входа.
        </p>

        <div className="welcome-legal">
          <a
            href="https://yandex.ru/legal/termsofuse/"
            target="_blank"
            rel="noopener noreferrer"
            className="legal-link"
          >
            Условия использования Яндекс Музыки
          </a>
          <span className="legal-sep">·</span>
          <a
            href="https://yandex.ru/legal/confidential/"
            target="_blank"
            rel="noopener noreferrer"
            className="legal-link"
          >
            Политика конфиденциальности Яндекс Музыки
          </a>
        </div>
      </div>
    </div>
  )
}
