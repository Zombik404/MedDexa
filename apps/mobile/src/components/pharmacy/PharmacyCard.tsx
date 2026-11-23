import type { PharmacySummary } from '@meddexa/shared';
import { useRouter } from 'expo-router';
import { MapPin, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge, Card, Text } from '@/components/ui';
import { flag, formatDistance } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export function OpenBadge({ open }: { open: boolean | null }) {
  const { t } = useTranslation();
  if (open === null) return <Badge label={t('common.hoursUnknown')} />;
  return <Badge label={open ? t('common.open') : t('common.closed')} tone={open ? 'success' : 'neutral'} />;
}

export function PharmacyCard({ pharmacy: p, compact, selected, onPress, testID }: { pharmacy: PharmacySummary; compact?: boolean; selected?: boolean; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const distance = formatDistance(p.distanceKm);
  return (
    <Card
      testID={testID}
      onPress={onPress ?? (() => router.push(`/pharmacy/${p.id}`))}
      accessibilityLabel={`${p.name}, ${p.address}`}
      style={[{ width: compact ? 250 : undefined }, selected ? { borderColor: colors.primary, borderWidth: 2 } : null]}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <MapPin size={20} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {p.name}
          </Text>
          <Text variant="small" color="textSecondary" numberOfLines={compact ? 1 : 2}>
            {flag(p.countryCode)} {p.address}
          </Text>
        </View>
        {distance ? (
          <Text variant="small" color="primary" style={{ fontFamily: 'Manrope_700Bold' }}>
            {distance}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
        <OpenBadge open={p.openNow} />
        {p.rating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Star size={13} color={colors.warning} fill={colors.warning} />
            <Text variant="small">{p.rating.average.toFixed(1)}</Text>
          </View>
        ) : null}
        {p.isDemo ? <Badge label={t('common.demoData')} tone="demo" /> : p.verified ? <Badge label={t('common.verified')} tone="success" /> : null}
      </View>
    </Card>
  );
}
