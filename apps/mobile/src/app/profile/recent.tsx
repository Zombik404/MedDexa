import { useRouter } from 'expo-router';
import { Clock, MapPin, Pill } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useHistoryMutations, useRecentlyViewed, useSignedIn } from '@/api/hooks';
import { Screen } from '@/components/Screen';
import { Button, EmptyState, Section } from '@/components/ui';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { useLocal } from '@/store/local';
import { spacing } from '@/theme/tokens';

export default function Recent() {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useSignedIn();
  const remote = useRecentlyViewed();
  const { clearRecent } = useHistoryMutations();
  const local = useLocal();
  const meds = signedIn ? (remote.data?.medicines ?? []).map((m) => ({ id: m.id, name: m.name })) : local.recentMedicines;
  const phs = signedIn ? (remote.data?.pharmacies ?? []).map((p) => ({ id: p.id, name: p.name })) : local.recentPharmacies;
  if (!meds.length && !phs.length) return <Screen topInset={false}><EmptyState icon={Clock} title={t('profile.empty')} /></Screen>;
  return (
    <Screen topInset={false}>
      {meds.length ? (
        <Section title={t('tabs.search')}>
          <ListGroup>{meds.map((m, i, a) => <ListRow key={m.id} icon={Pill} title={m.name} onPress={() => router.push(`/medicine/${m.id}`)} last={i === a.length - 1} />)}</ListGroup>
        </Section>
      ) : null}
      {phs.length ? (
        <Section title={t('tabs.pharmacies')}>
          <ListGroup>{phs.map((p, i, a) => <ListRow key={p.id} icon={MapPin} title={p.name} onPress={() => router.push(`/pharmacy/${p.id}`)} last={i === a.length - 1} />)}</ListGroup>
        </Section>
      ) : null}
      <View style={{ marginTop: spacing.md }}>
        <Button label={t('common.clear')} variant="danger" size="sm" onPress={() => (signedIn ? clearRecent.mutate() : useLocal.setState({ recentMedicines: [], recentPharmacies: [] }))} />
      </View>
    </Screen>
  );
}
