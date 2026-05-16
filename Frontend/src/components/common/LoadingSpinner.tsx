import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  /** xs | sm | md | lg — varsayılan: md */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** İsteğe bağlı görünür etiket (yoksa erişilebilirlik için sr-only kullanılır) */
  label?: string;
  /** Görsel olarak da etiketi göster */
  showLabel?: boolean;
  /** Ek sınıf adları */
  className?: string;
  /** Tam alan kaplayan merkezleme yardımcı kabuğu */
  fullScreen?: boolean;
  /** Inline (satır içi) kullanım */
  inline?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label = 'Yükleniyor...',
  showLabel = false,
  className = '',
  fullScreen = false,
  inline = false,
}) => {
  const wrapperClass = [
    'loading-wrapper',
    fullScreen ? 'loading-wrapper--full' : '',
    inline ? 'loading-wrapper--inline' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClass} role="status" aria-live="polite">
      <span className={`loading-spinner loading-spinner--${size}`} aria-hidden="true" />
      {showLabel ? (
        <span className="loading-label">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
};

export default LoadingSpinner;
