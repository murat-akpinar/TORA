import { showGlobalToast, ToastVariant } from '../components/common/Toast';
import { extractErrorMessage } from './errorMessages';

/**
 * Provider erişimi olmayan yerlerde (servis, util, hook dışı) toast tetiklemek için.
 * Hook erişimi olan yerlerde useToast() tercih edilmelidir.
 */
export const notify = {
  show: (message: string, variant: ToastVariant = 'info', duration?: number) =>
    showGlobalToast(message, variant, duration),
  success: (message: string, duration?: number) =>
    showGlobalToast(message, 'success', duration),
  info: (message: string, duration?: number) =>
    showGlobalToast(message, 'info', duration),
  warning: (message: string, duration = 5000) =>
    showGlobalToast(message, 'warning', duration),
  error: (message: string, duration = 6000) =>
    showGlobalToast(message, 'error', duration),
  fromError: (error: unknown, fallback = 'Beklenmeyen bir hata oluştu') =>
    showGlobalToast(extractErrorMessage(error, fallback), 'error', 6000),
};
