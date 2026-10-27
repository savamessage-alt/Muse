import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Глобальный перехват ошибок → телеметрия (для отладки «чёрного экрана»)
window.addEventListener('error', (e) => {
  try {
    void fetch('/__diag', {
      method: 'POST',
      body: JSON.stringify({ fact: 'window-error', href: location.href, message: String(e.message) }),
    }).catch(() => {})
  } catch {
    /* ignore */
  }
})
window.addEventListener('unhandledrejection', (e) => {
  try {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    void fetch('/__diag', {
      method: 'POST',
      body: JSON.stringify({ fact: 'unhandledrejection', href: location.href, message: msg.slice(0, 300) }),
    }).catch(() => {})
  } catch {
    /* ignore */
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)