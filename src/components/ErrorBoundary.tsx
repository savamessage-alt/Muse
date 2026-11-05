import { Component, type ErrorInfo, type ReactNode } from 'react'
import { tokenManager } from '../core/tokenManager'
import { diag } from '../core/diag'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Перехватывает ошибки отрисовки: показывает текст вместо «чёрного экрана» и шлёт в телеметрию */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Muse] Ошибка отрисовки:', error, info.componentStack)
    try {
      diag('render-error', tokenManager.getToken())
      void fetch('/__diag', {
        method: 'POST',
        body: JSON.stringify({
          fact: 'render-error',
          href: location.href,
          message: String(error?.message ?? error),
          stack: String(error?.stack ?? '').slice(0, 800),
          component: String(info?.componentStack ?? '').slice(0, 400),
        }),
      }).catch(() => {})
    } catch {
      /* не критично */
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="bootscreen" style={{ padding: 24 }}>
          <h1 style={{ color: '#ff8a9a', fontSize: 22 }}>Что-то пошло не так</h1>
          <p className="muted" style={{ maxWidth: 520 }}>
            {String(this.state.error.message || this.state.error)}
          </p>
          <p className="muted small">
            Ошибка отправлена разработчику. Если она повторяется — нажмите «Перезагрузить».
          </p>
          <button className="btn" onClick={() => location.reload()}>
            Перезагрузить
          </button>
        </div>
      )
    }
    return this.props.children
  }
}