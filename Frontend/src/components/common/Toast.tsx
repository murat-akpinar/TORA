import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import './Toast.css';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'i',
  warning: '!',
};

const VARIANT_LABELS: Record<ToastVariant, string> = {
  success: 'Başarılı',
  error: 'Hata',
  info: 'Bilgi',
  warning: 'Uyarı',
};

let toastCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 4000) => {
      const id = `toast-${++toastCounter}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
    },
    []
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, duration) => show(message, 'success', duration),
      error: (message, duration) => show(message, 'error', duration ?? 6000),
      info: (message, duration) => show(message, 'info', duration),
      warning: (message, duration) => show(message, 'warning', duration ?? 5000),
    }),
    [show]
  );

  // Bridge: api.ts içindeki interceptor'ın window üzerinden global olarak
  // toast tetiklemesine izin verir.
  useEffect(() => {
    (window as any).__appToast = value;
    return () => {
      delete (window as any).__appToast;
    };
  }, [value]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Bildirimler">
        {toasts.map((toast) => (
          <ToastEntry key={toast.id} toast={toast} onClose={() => remove(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastEntry: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = window.setTimeout(onClose, toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration, onClose]);

  return (
    <div
      className={`toast toast-${toast.variant}`}
      role={toast.variant === 'error' || toast.variant === 'warning' ? 'alert' : 'status'}
    >
      <span className={`toast-icon toast-icon-${toast.variant}`} aria-hidden="true">
        {VARIANT_ICONS[toast.variant]}
      </span>
      <div className="toast-body">
        <strong className="toast-title">{VARIANT_LABELS[toast.variant]}</strong>
        <span className="toast-message">{toast.message}</span>
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={onClose}
        aria-label="Bildirimi kapat"
      >
        ×
      </button>
    </div>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast yalnızca ToastProvider içinden çağrılabilir');
  }
  return context;
};

/**
 * Provider dışından (örn. axios interceptor) güvenli toast erişimi.
 * Provider hazır değilse sessizce yutar; opsiyonel olarak console.warn'a
 * düşer.
 */
export const showGlobalToast = (
  message: string,
  variant: ToastVariant = 'info',
  duration?: number
) => {
  const provider = (window as any).__appToast as ToastContextValue | undefined;
  if (provider) {
    provider.show(message, variant, duration);
  } else if (variant === 'error') {
    console.error('[toast:error]', message);
  } else {
    console.info(`[toast:${variant}]`, message);
  }
};
