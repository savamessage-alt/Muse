import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from './state/store'
import { tokenManager } from './core/tokenManager'
import LoginPage from './components/LoginPage'
import WelcomePage from './components/WelcomePage'
import Layout from './components/Layout'
import HomePage from './components/HomePage'
import SearchPage from './components/SearchPage'
import PlaylistsPage from './components/PlaylistsPage'
import PlaylistPage from './components/PlaylistPage'
import AlbumPage from './components/AlbumPage'
import ArtistPage from './components/ArtistPage'
import FavoritesPage from './components/FavoritesPage'
import HistoryPage from './components/HistoryPage'
import RadioPage from './components/RadioPage'
import SettingsPage from './components/SettingsPage'
import Toasts from './components/Toasts'
import ErrorBoundary from './components/ErrorBoundary'

function BootGate({ children }: { children: ReactNode }) {
  const booted = useApp((s) => s.booted)
  const forceBoot = useApp((s) => s.forceBoot)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 12000)
    return () => clearTimeout(t)
  }, [])
  if (!booted) {
    return (
      <div className="bootscreen">
        <div className="spinner large" />
        <p>{slow ? 'Загрузка затянулась. Можно открыть плеер без фоновых данных.' : 'Запуск плеера…'}</p>
        {slow && (
          <button className="btn" onClick={forceBoot}>
            Продолжить вручную
          </button>
        )}
      </div>
    )
  }
  return <>{children}</>
}

function LoginGate() {
  const authenticated = useApp((s) => s.authenticated)
  if (authenticated) return <Navigate to="/" replace />
  return <LoginPage />
}

function WelcomeGate() {
  const authenticated = useApp((s) => s.authenticated)
  if (authenticated) return <Navigate to="/" replace />
  return <WelcomePage />
}

/** Плеер доступен только с аккаунтом; без токена — экран-приветствие */
function RequireAuth({ children }: { children: ReactNode }) {
  const authenticated = useApp((s) => s.authenticated)
  if (!authenticated) return <Navigate to="/welcome" replace />
  return <>{children}</>
}

function ReauthWatcher() {
  const navigate = useNavigate()
  useEffect(() => {
    return tokenManager.onReauthNeeded(() => {
      useApp.setState({ authenticated: false })
      useApp.getState().showToast('Сессия истекла — войдите заново', 'error')
      navigate('/login')
    })
  }, [navigate])
  return null
}

/** Красивая заставка при входе в приложение: пульсирующий диск-логотип, гашение */
function Splash({ onDone }: { onDone: () => void }) {
  const [hide, setHide] = useState(false)
  const first = useRef(true)
  const loc = useLocation()
  // при первой навигации пользователя прячем заставку (не мешает управлению)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setHide(true)
  }, [loc])
  useEffect(() => {
    const t1 = setTimeout(() => setHide(true), 1600)
    const t2 = setTimeout(onDone, 2300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [onDone])
  return (
    <div className={'splash' + (hide ? ' hide' : '')} aria-hidden="true">
      <div className="splash-inner">
        <div className="splash-disc"><span>♪</span></div>
        <div className="splash-name">Muse</div>
        <div className="splash-tag">музыка без границ</div>
      </div>
    </div>
  )
}

export default function App() {
  const booted = useApp((s) => s.booted)
  const authenticated = useApp((s) => s.authenticated)
  const [splashDone, setSplashDone] = useState(false)
  useEffect(() => {
    if (!booted) void useApp.getState().boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted])

  return (
    <ErrorBoundary>
      <HashRouter>
        <BootGate>
          <ReauthWatcher />
          <Routes>
            <Route path="/login" element={<LoginGate />} />
            <Route path="/welcome" element={<WelcomeGate />} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/playlist/:kind" element={<PlaylistPage />} />
              <Route path="/album/:id" element={<AlbumPage />} />
              <Route path="/artist/:id" element={<ArtistPage />} />
              <Route path="/likes" element={<FavoritesPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/radio" element={<RadioPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toasts />
          {booted && authenticated && !splashDone && <Splash onDone={() => setSplashDone(true)} />}
        </BootGate>
      </HashRouter>
    </ErrorBoundary>
  )
}