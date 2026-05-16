import { AxiosError } from 'axios';

const STATUS_FALLBACK: Record<number, string> = {
  400: 'Gönderilen bilgiler geçerli değil.',
  401: 'Oturum süresi doldu, lütfen tekrar giriş yapın.',
  403: 'Bu işlem için yetkiniz yok.',
  404: 'İstenen kayıt bulunamadı.',
  409: 'Çakışan bir kayıt var, lütfen tekrar deneyin.',
  422: 'Doğrulama hatası, alanları gözden geçirin.',
  429: 'Çok sık istek gönderdiniz, biraz bekleyin.',
  500: 'Sunucuda beklenmeyen bir hata oluştu.',
  502: 'Sunucuya ulaşılamıyor, lütfen daha sonra deneyin.',
  503: 'Hizmet geçici olarak kullanılamıyor.',
  504: 'Sunucu yanıt vermedi, lütfen tekrar deneyin.',
};

interface ApiErrorBody {
  error?: string;
  message?: string;
  details?: string;
}

/**
 * Axios hatalarından kullanıcı dostu, Türkçe bir mesaj türetir.
 * Backend genellikle `{ error: "..." }` döner; o öncelikli kullanılır.
 */
export const extractErrorMessage = (error: unknown, fallback = 'Beklenmeyen bir hata oluştu'): string => {
  if (!error) return fallback;

  const axiosErr = error as AxiosError<ApiErrorBody>;

  if (axiosErr.isAxiosError) {
    if (axiosErr.code === 'ERR_NETWORK' || !axiosErr.response) {
      return 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.';
    }

    const status = axiosErr.response.status;
    const body = axiosErr.response.data;
    const apiMessage = body?.error || body?.message || body?.details;
    if (apiMessage && typeof apiMessage === 'string' && apiMessage.trim() !== '') {
      return apiMessage;
    }
    return STATUS_FALLBACK[status] ?? fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
};
