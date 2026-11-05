import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../state/store'
import PlayerBar from './PlayerBar'
import ResumePosition from './ResumePosition'
import { IconHome, IconSearch, IconRadio, IconHeart, IconHistory, IconSettings, IconList } from './icons'
import { PLACEHOLDER_COVER, coverUrl } from '../core/format'

export default function Layout() {
  const user = useApp((s) => s.user)
  const playlists = useApp((s) => s.playlists)

  const nav = [
    { to: '/', label: 'Главная', icon: IconHome, end: true },
    { to: '/search', label: 'Поиск', icon: IconSearch },
    { to: '/radio', label: 'Радио', icon: IconRadio },
    { to: '/likes', label: 'Мне нравится', icon: IconHeart },
    { to: '/history', label: 'История', icon: IconHistory },
  ]

  return (
    <div className="app">
      <div className="body">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <span className="logo-dot" />
            Muse
          </div>
          <nav className="nav">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                <Icon size={20} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <IconList size={16} /> Мои плейлисты
            </div>
            <div className="playlist-list">
              {Array.isArray(playlists) && playlists.slice(0, 30).map((pl) => (
                <NavLink key={pl.kind} to={`/playlist/${pl.kind}`} className="pl-link">
                  {pl.title || 'Без названия'}
                </NavLink>
              ))}
              {(!Array.isArray(playlists) || playlists.length === 0) && <span className="muted small">Пока пусто</span>}
            </div>
          </div>
          <div className="sidebar-bottom">
            <NavLink to="/settings" className="nav-link">
              <IconSettings size={20} />
              <span>Настройки</span>
            </NavLink>
            {user && (
              <div className="user-chip" title={String(user.login ?? user.uid ?? '')}>
                <img
                  src={coverUrl(user.coverUri) ?? PLACEHOLDER_COVER}
                  alt=""
                  className="user-avatar"
                  onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
                />
                <span>{user.displayName ?? user.login ?? 'Аккаунт'}</span>
              </div>
            )}
          </div>
        </aside>
        <main className="content">
          <Outlet />
        </main>
      </div>
      <PlayerBar />
      <nav className="mobile-nav">
        {[
          ...nav.map((n) => (n.to === '/likes' ? { ...n, label: 'Лайки' } : n)),
          { to: '/settings', label: 'Настройки', icon: IconSettings },
        ].map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <ResumePosition />
    </div>
  )
}