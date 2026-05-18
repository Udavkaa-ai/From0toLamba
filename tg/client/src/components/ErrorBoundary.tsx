import { Component, ReactNode, ErrorInfo } from 'react'

interface State {
  error: Error | null
  info: ErrorInfo | null
}

/**
 * Глобальный ErrorBoundary поверх всего приложения. Без него любое
 * исключение в render-фазе размонтирует весь поддерев React'а — экран
 * становится пустым, и игрок не понимает что произошло.
 *
 * Если поймали ошибку — показываем кнопку «Перезапустить» (window.reload)
 * + сам текст ошибки и стек (для отладки на телефоне).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] uncaught:', error, info)
    this.setState({ error, info })
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0D1735',
        color: '#FFFFFF',
        padding: '24px',
        overflow: 'auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        lineHeight: 1.55,
        WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{
          color: '#FFB800', fontSize: 18, fontWeight: 700,
          marginBottom: 8,
        }}>
          ⚠ Что-то пошло не так
        </div>
        <div style={{ marginBottom: 16, opacity: 0.85 }}>
          Приложение поймало ошибку при отрисовке. Нажми «Перезапустить» —
          обычно помогает. Если повторится — пришли админу скриншот этого
          экрана со стеком ниже.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            display: 'block',
            margin: '0 0 20px',
            padding: '10px 22px',
            background: '#FFB800',
            color: '#0D1735',
            border: 'none', borderRadius: 10,
            fontWeight: 700, fontSize: 14,
            cursor: 'pointer',
          }}
        >
          🔄 Перезапустить
        </button>
        <div style={{
          padding: 12,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,184,0,0.35)',
          borderRadius: 8,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 11,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          <div style={{ color: '#FFB800', marginBottom: 6 }}>
            {error.name}: {error.message}
          </div>
          <div style={{ opacity: 0.7 }}>
            {error.stack ?? '(stack недоступен)'}
          </div>
          {info?.componentStack && (
            <div style={{ marginTop: 10, opacity: 0.6 }}>
              <div style={{ color: '#FFB800', opacity: 0.7 }}>Component stack:</div>
              {info.componentStack}
            </div>
          )}
        </div>
      </div>
    )
  }
}
