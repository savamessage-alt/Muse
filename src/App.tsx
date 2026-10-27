import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useApp } from './state/store'
import { tokenManager } from './core/tokenManager'
import LoginPage from './components/LoginPage'
import Layout from './components/Layout'
import HomePage from './components/HomePage'
import SearchPage from './components/SearchPage'
import PlaylistsPage from './components/PlaylistsPage'
import PlaylistPage from './components/PlaylistPage'
import AlbumPage from './components/AlbumPage'
import ArtistPage from './components/ArtistPage'
import LikesPage from './components/LikesPage'
import HistoryPage from './components/HistoryPage'
import RadioPage from './components/RadioPage'
import SettingsPage from './components/SettingsPage'
import Toasts from './components/Toasts'

function BootGate({ children }: { children: ReactNode }) {
  const booted = useApp((s) => s.booted)
  if (!booted) {
    return (
      <div className="bootscreen">
        <div className="spinner large" />
        <p>Запуск плеера…</p>
      </div>
    )
  }
  return <>{children}</>
}

function ReauthWatcher() {
  const navigate = useNavigate()
  useEffect(() => {
    return tokenManager.onReauthNeeded(() => {
      useApp.setState({ authenticated: false })
      useApp.getState().showToast('Токен Яндекса истёк или отозван — войдите заново', 'error')
      navigate('/login')
    })
  }, [navigate])
  return null
}

export default function App() {
  const booted = useApp((s) => s.booted)
  useEffect(() => {
    if (!booted) void useApp.getState().boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted])

  return (
    <HashRouter>
      <BootGate>
        <ReauthWatcher />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/playlist/:kind" element={<PlaylistPage />} />
            <Route path="/album/:id" element={<AlbumPage />} />
            <Route path="/artist/:id" element={<ArtistPage />} />
            <Route path="/likes" element={<LikesPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/radio" element={<RadioPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toasts />
      </BootGate>
    </HashRouter>
  )
}