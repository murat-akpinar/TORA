/**
 * Tek dosyalık küçük form validasyon yardımcısı.
 * Daha büyük form ihtiyaçları için ileride zod/yup gibi kütüphanelere geçilebilir.
 */

export type ValidationRule<T> = (value: T) => string | null;

export type FieldRules<TValues> = {
  [K in keyof TValues]?: ValidationRule<TValues[K]>[];
};

export type FieldErrors<TValues> = Partial<Record<keyof TValues, string>>;

export const validateForm = <TValues extends Record<string, any>>(
  values: TValues,
  rules: FieldRules<TValues>
): FieldErrors<TValues> => {
  const errors: FieldErrors<TValues> = {};
  (Object.keys(rules) as Array<keyof TValues>).forEach((field) => {
    const fieldRules = rules[field] || [];
    for (const rule of fieldRules) {
      const error = rule(values[field]);
      if (error) {
        errors[field] = error;
        break;
      }
    }
  });
  return errors;
};

export const isFormValid = <TValues>(errors: FieldErrors<TValues>): boolean => {
  return Object.keys(errors).length === 0;
};

// --- Yaygın kurallar ----------------------------------------------------------

export const required =
  (message = 'Bu alan zorunludur'): ValidationRule<unknown> =>
  (value) => {
    if (value === null || value === undefined) return message;
    if (typeof value === 'string' && value.trim() === '') return message;
    if (Array.isArray(value) && value.length === 0) return message;
    return null;
  };

export const minLength =
  (min: number, message?: string): ValidationRule<string> =>
  (value) => {
    if (value == null) return null;
    if (value.length < min) {
      return message ?? `En az ${min} karakter olmalı`;
    }
    return null;
  };

export const maxLength =
  (max: number, message?: string): ValidationRule<string> =>
  (value) => {
    if (value == null) return null;
    if (value.length > max) {
      return message ?? `En fazla ${max} karakter olabilir`;
    }
    return null;
  };

/**
 * İki alan arasında "start <= end" kontrolü için yardımcı.
 * validateForm field-bazlı çalıştığı için cross-field kontrol bunun
 * gibi ayrı bir helper ile yapılır.
 */
export const validateDateOrder = (
  startDate: string | undefined,
  endDate: string | undefined,
  message = 'Bitiş tarihi başlangıçtan önce olamaz'
): string | null => {
  if (!startDate || !endDate) return null;
  if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
    return message;
  }
  return null;
};
