import { useTranslation } from 'react-i18next';
import { useFavoriteMutations, useFavorites, useSignedIn } from '@/api/hooks';
import { useToast } from '@/components/ui/Toast';
import { useLocal } from '@/store/local';

/** One favourites API for guests (device storage) and signed-in users (account). */
export function useFavoriteToggle() {
  const signedIn = useSignedIn();
  const remote = useFavorites();
  const { add, remove } = useFavoriteMutations();
  const local = useLocal();
  const toast = useToast();
  const { t } = useTranslation();

  const isMedicine = (id: string) =>
    signedIn ? !!remote.data?.some((f) => f.medicine?.id === id) : local.favoriteMedicines.some((f) => f.id === id);
  const isPharmacy = (id: string) =>
    signedIn ? !!remote.data?.some((f) => f.pharmacy?.id === id) : local.favoritePharmacies.some((f) => f.id === id);

  const toggleMedicine = (m: { id: string; name: string }) => {
    if (signedIn) {
      const on = isMedicine(m.id);
      (on ? remove : add).mutate({ medicineId: m.id });
      toast(on ? t('common.clear') : t('pharmacies.saved'));
    } else {
      const on = local.toggleFavoriteMedicine(m);
      toast(on ? t('pharmacies.saved') : t('common.clear'));
    }
  };
  const togglePharmacy = (p: { id: string; name: string }) => {
    if (signedIn) {
      const on = isPharmacy(p.id);
      (on ? remove : add).mutate({ pharmacyId: p.id });
      toast(on ? t('common.clear') : t('pharmacies.saved'));
    } else {
      const on = local.toggleFavoritePharmacy(p);
      toast(on ? t('pharmacies.saved') : t('common.clear'));
    }
  };
  return { isMedicine, isPharmacy, toggleMedicine, togglePharmacy };
}
