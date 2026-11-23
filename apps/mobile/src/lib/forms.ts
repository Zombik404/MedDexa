import type { TFunction } from 'i18next';
import { ApiError } from '@/api/client';

/** Zod messages in shared schemas are i18n keys; fall back to the raw text otherwise. */
export function fieldError(t: TFunction, message?: string): string | undefined {
  if (!message) return undefined;
  return t(message, { defaultValue: message });
}

export function apiErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetwork) return t('errors.networkBody');
    if (error.code) {
      const key = `auth.errors.${error.code}`;
      const translated = t(key, { defaultValue: '' });
      if (translated) return translated;
    }
    return error.message;
  }
  return t('errors.body');
}
