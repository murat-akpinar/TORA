import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ErrorPage.css';

export type ErrorType = '403' | '500' | 'network';

interface ErrorConfig {
  code: string;
  icon: string;
  title: string;
  message: string;
  detail: string;
  primaryLabel: string;
  primaryAction: () => void;
  secondaryLabel?: string;
  secondaryAction?: () => void;
}

interface Props {
  type?: ErrorType;
}

const ErrorPage: React.FC<Props> = ({ type = '500' }) => {
  const navigate = useNavigate();

  const configs: Record<ErrorType, ErrorConfig> = {
    '403': {
      code: '403',
      icon: '🔒',
      title: 'Erişim Reddedildi',
      message: 'Bu sayfayı görüntüleme yetkiniz bulunmuyor.',
      detail: 'Eğer bu bir hata olduğunu düşünüyorsanız, sistem yöneticinizle iletişime geçin.',
      primaryLabel: 'Ana Sayfaya Dön',
      primaryAction: () => navigate('/'),
    },
    '500': {
      code: '500',
      icon: '⚠️',
      title: 'Sunucu Hatası',
      message: 'Sunucuda beklenmeyen bir hata oluştu.',
      detail: 'Sorunu çözmek için çalışıyoruz. Lütfen bir süre sonra tekrar deneyin.',
      primaryLabel: 'Sayfayı Yenile',
      primaryAction: () => window.location.reload(),
      secondaryLabel: 'Ana Sayfaya Dön',
      secondaryAction: () => navigate('/'),
    },
    network: {
      code: '—',
      icon: '📡',
      title: 'Bağlantı Hatası',
      message: 'Sunucuya bağlanılamadı.',
      detail: 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
      primaryLabel: 'Tekrar Dene',
      primaryAction: () => window.location.reload(),
      secondaryLabel: 'Ana Sayfaya Dön',
      secondaryAction: () => navigate('/'),
    },
  };

  const cfg = configs[type];

  return (
    <main className="error-page" role="main" aria-labelledby="error-page-title">
      <div className="error-page-card">
        <div className="error-page-icon" aria-hidden="true">{cfg.icon}</div>
        <div
          className="error-page-code"
          aria-label={`Hata kodu: ${cfg.code}`}
        >
          {cfg.code}
        </div>
        <h1 id="error-page-title" className="error-page-title">{cfg.title}</h1>
        <p className="error-page-message">{cfg.message}</p>
        <p className="error-page-detail">{cfg.detail}</p>
        <div className="error-page-actions">
          <button
            className="error-page-btn error-page-btn-primary"
            onClick={cfg.primaryAction}
          >
            {cfg.primaryLabel}
          </button>
          {cfg.secondaryAction && (
            <button
              className="error-page-btn error-page-btn-secondary"
              onClick={cfg.secondaryAction}
            >
              {cfg.secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </main>
  );
};

export default ErrorPage;
