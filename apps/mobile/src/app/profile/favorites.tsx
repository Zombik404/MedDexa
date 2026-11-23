import { useRouter } from 'expo-router';
import { Heart, MapPin, Pill } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useFavorites, useSignedIn } from '@/api/hooks';
import { MedicineCard } from '@/components/medicine/MedicineCard';
import { PharmacyCard } from '@/components/pharmacy/PharmacyCard';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, ListSkeleton, Section } from '@/components/ui';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { useLocal } from '@/store/local';
import { spacing } from '@/theme/tokens';

export default function Favorites() {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useSignedIn();
  const remote = useFavorites();
  const local = useLocal();

  if (signedIn) {
    if (remote.isLoading) return <Screen topInset={false}><ListSkeleton /></Screen>;
    if (remote.error) return <Screen topInset={false}><ErrorState error={remote.error} onRetry={() => remote.refetch()} /></Screen>;
    const meds = (remote.data ?? []).filter((f) => f.medicine);
    const phs = (remote.data ?? []).filter((f) => f.pharmacy);
    if (!meds.length && !phs.length) return <Screen topInset={false}><EmptyState icon={Heart} title={t('profile.empty')} /></Screen>;
    return (
      <Screen topInset={false} refreshing={remote.isRefetching} onRefresh={() => remote.refetch()}>
        {meds.length ? (
          <Section title={t('tabs.search')}>
            <View style={{ gap: spacing.md }}>{meds.map((f) => <MedicineCard key={f.id} medicine={f.medicine!} />)}</View>
          </Section>
        ) : null}
        {phs.length ? (
          <Section title={t('tabs.pharmacies')}>
            <View style={{ gap: spacing.md }}>{phs.map((f) => <PharmacyCard key={f.id} pharmacy={f.pharmacy!} />)}</View>
          </Section>
        ) : null}
      </Screen>
    );
  }

  if (!local.favoriteMedicines.length && !local.favoritePharmacies.length) {
    return <Screen topInset={false}><EmptyState icon={Heart} title={t('profile.empty')} body={t('profile.guestBody')} /></Screen>;
  }
  return (
    <Screen topInset={false}>
      {local.favoriteMedicines.length ? (
        <Section title={t('tabs.search')}>
          <ListGroup>
            {local.favoriteMedicines.map((m, i, a) => <ListRow key={m.id} icon={Pill} title={m.name} onPress={() => router.push(`/medicine/${m.id}`)} last={i === a.length - 1} />)}
          </ListGroup>
        </Section>
      ) : null}
      {local.favoritePharmacies.length ? (
        <Section title={t('tabs.pharmacies')}>
          <ListGroup>
            {local.favoritePharmacies.map((p, i, a) => <ListRow key={p.id} icon={MapPin} title={p.name} onPress={() => router.push(`/pharmacy/${p.id}`)} last={i === a.length - 1} />)}
          </ListGroup>
        </Section>
      ) : null}
    </Screen>
  );
}
