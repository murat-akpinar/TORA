import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'var(--ctp-base)',
          padding: '20px',
        }}
        role="main"
        aria-labelledby="eb-title"
      >
        <div
          style={{
            textAlign: 'center',
            maxWidth: '600px',
            padding: '48px 40px',
            background: 'var(--ctp-mantle)',
            borderRadius: '16px',
            border: '1px solid var(--ctp-surface0)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontSize: '52px', marginBottom: '12px' }}>⚠️</div>
          <div
            style={{
              fontSize: '88px',
              fontWeight: 'bold',
              color: 'var(--ctp-red)',
              lineHeight: 1,
              marginBottom: '16px',
              fontFamily: "'Cascadia Mono', monospace",
            }}
          >
            500
          </div>
          <h1
            id="eb-title"
            style={{ color: 'var(--ctp-text)', marginBottom: '12px', fontSize: '24px' }}
          >
            Beklenmeyen Hata
          </h1>
          <p style={{ color: 'var(--ctp-subtext1)', marginBottom: '8px', lineHeight: 1.6 }}>
            Bir şeyler yanlış gitti. Sayfayı yenilemek sorunu çözebilir.
          </p>
          {this.state.error && (
            <details
              style={{
                textAlign: 'left',
                background: 'var(--ctp-surface0)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '24px',
                marginTop: '16px',
                fontSize: '12px',
                color: 'var(--ctp-subtext0)',
              }}
            >
              <summary style={{ cursor: 'pointer', color: 'var(--ctp-subtext1)' }}>
                Hata detayı
              </summary>
              <pre style={{ marginTop: '8px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 32px',
              background: 'var(--ctp-blue)',
              color: 'var(--ctp-base)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Cascadia Mono', monospace",
            }}
          >
            Sayfayı Yenile
          </button>
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;
