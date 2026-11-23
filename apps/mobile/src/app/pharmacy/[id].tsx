import { Stack, useLocalSearchParams } from 'expo-router';
import { Globe, Heart, MapPin, Navigation, Phone, ShieldAlert } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { usePharmacy, useSignedIn } from '@/api/hooks';
import { OpenBadge } from '@/components/pharmacy/PharmacyCard';
import { ReviewsBlock } from '@/components/Reviews';
import { Screen } from '@/components/Screen';
import { Badge, Button, Card, ErrorState, IconButton, ListSkeleton, ProvenanceLine, Section, Stars, Text } from '@/components/ui';
import { useFavoriteToggle } from '@/hooks/useFavorites';
import { useLocation } from '@/hooks/useLocation';
import { countryName, flag, formatDistance } from '@/lib/format';
import { callPhone, openDirections, openWebsite } from '@/lib/links';
import { useLocal } from '@/store/local';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function PharmacyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const location = useLocation();
  const q = usePharmacy(id, location.coords);
  const fav = useFavoriteToggle();
  const signedIn = useSignedIn();
  const viewed = useLocal((s) => s.viewedPharmacy);
  const p = q.data;

  useEffect(() => {
    if (p && !signedIn) viewed({ id: p.id, name: p.name });
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <Screen topInset={false}><ListSkeleton count={3} /></Screen>;
  if (q.error || !p) return <Screen topInset={false}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;

  const days = t('days', { returnObjects: true }) as string[];
  const today = (new Date().getDay() + 6) % 7;
  const saved = fav.isPharmacy(p.id);
  // Actions are only offered when the underlying detail is verified (spec: never act on unverified contact data).
  const canCall = !!p.phone && p.phoneVerified;
  const canWeb = !!p.website && p.websiteVerified;
  const distance = formatDistance(p.distanceKm);

  return (
    <Screen topInset={false} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => <IconButton testID="favorite-pharmacy" icon={Heart} label={saved ? t('pharmacies.saved') : t('pharmacies.save')} active={saved} tone="plain" size={36} onPress={() => fav.togglePharmacy({ id: p.id, name: p.name })} />,
        }}
      />
      <Text variant="h1" accessibilityRole="header">
        {p.name}
      </Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: 4 }}>
        {flag(p.countryCode)} {p.address} · {countryName(p.countryCode)}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
        <OpenBadge open={p.openNow} />
        {distance ? <Badge label={distance} tone="primary" icon={MapPin} /> : null}
        {p.rating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Stars value={p.rating.average} />
            <Text variant="small">({p.rating.count})</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xxl }}>
        <Button testID="pharmacy-directions" label={t('pharmacies.directions')} icon={Navigation} onPress={() => void openDirections(p.lat, p.lng, p.name)} style={{ flex: 1 }} />
        {canCall ? <Button label={t('pharmacies.call')} icon={Phone} variant="secondary" onPress={() => void callPhone(p.phone!)} style={{ flex: 1 }} /> : null}
        {canWeb ? <Button label={t('pharmacies.website')} icon={Globe} variant="secondary" onPress={() => void openWebsite(p.website!)} style={{ flex: 1 }} /> : null}
      </View>

      {!canCall || !canWeb ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, marginBottom: spacing.xxl }}>
          <ShieldAlert size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
          <Text variant="small" color="textSecondary" style={{ flex: 1 }}>
            {t('pharmacies.unverifiedContact')}
          </Text>
        </View>
      ) : null}

      <Section title={t('pharmacies.hours')}>
        <Card padded={false}>
          {p.openingHours.length ? (
            days.map((name, day) => {
              const spans = p.openingHours.filter((h) => h.day === day);
              return (
                <View key={day} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: day ? 1 : 0, borderTopColor: colors.border, backgroundColor: day === today ? colors.primarySoft : 'transparent' }}>
                  <Text variant={day === today ? 'bodyStrong' : 'body'}>{name}</Text>
                  <Text variant={day === today ? 'bodyStrong' : 'body'} color={spans.length ? 'text' : 'textTertiary'}>
                    {spans.length ? spans.map((s) => `${s.opens}–${s.closes}`).join(', ') : t('common.closed')}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text color="textSecondary" style={{ padding: spacing.lg }}>
              {t('common.hoursUnknown')}
            </Text>
          )}
        </Card>
      </Section>

      {p.services.length ? (
        <Section title={t('pharmacies.services')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {p.services.map((s) => (
              <Badge key={s.code} label={s.name} tone="primary" />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title={t('pharmacies.contact')}>
        <Card>
          <Text variant="caption" color="textTertiary" style={{ textTransform: 'uppercase' }}>
            {t('pharmacies.address')}
          </Text>
          <Text variant="bodyStrong" style={{ marginBottom: spacing.sm }}>
            {p.address}
          </Text>
          {p.phone ? <Text variant="body">{p.phone}{p.phoneVerified ? '' : ` · ${t('common.unverified')}`}</Text> : null}
          {p.website ? <Text variant="body" numberOfLines={1}>{p.website}{p.websiteVerified ? '' : ` · ${t('common.unverified')}`}</Text> : null}
          <View style={{ marginTop: spacing.md }}>
            <ProvenanceLine provenance={p.provenance} />
          </View>
        </Card>
      </Section>

      {p.ratingBreakdown ? (
        <Section title={t('reviews.title')}>
          <Card>
            {(['staff', 'service', 'waiting', 'cleanliness', 'accessibility'] as const).map((k) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                <Text variant="body">{t(`reviews.${k}`)}</Text>
                {p.ratingBreakdown![k] != null ? <Stars value={p.ratingBreakdown![k]!} /> : <Text color="textTertiary">—</Text>}
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title={p.ratingBreakdown ? '' : t('reviews.title')}>
        <ReviewsBlock target="pharmacies" id={p.id} name={p.name} />
      </Section>
    </Screen>
  );
}
