import { api } from '@/api/client';
import { useLocal } from '@/store/local';
import { usePreferences } from '@/store/preferences';

/**
 * After sign-in, copies guest favourites and preferences to the account so nothing the
 * user saved as a guest is lost. Device copies are then cleared (the account is the source of truth).
 */
export function useSyncGuestData() {
  return async () => {
    const local = useLocal.getState();
    const prefs = usePreferences.getState();
    await Promise.allSettled([
      ...local.favoriteMedicines.map((m) => api('/me/favorites', { method: 'POST', body: { medicineId: m.id }, auth: true })),
      ...local.favoritePharmacies.map((p) => api('/me/favorites', { method: 'POST', body: { pharmacyId: p.id }, auth: true })),
      api('/me/preferences', {
        method: 'PATCH',
        auth: true,
        body: { currency: prefs.currency, theme: prefs.theme, saveSearchHistory: prefs.saveSearchHistory, ...(prefs.language ? { language: prefs.language } : {}) },
      }),
    ]);
    useLocal.setState({ favoriteMedicines: [], favoritePharmacies: [] });
  };
}
