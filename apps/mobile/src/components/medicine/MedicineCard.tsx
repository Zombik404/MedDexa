import type { MedicineSummary } from '@meddexa/shared';
import { useRouter } from 'expo-router';
import { Check, GitCompareArrows, Pill, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Badge, Card, Text } from '@/components/ui';
import { flag, formatMoney } from '@/lib/format';
import { useCompare } from '@/store/compare';
import { useToast } from '@/components/ui/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export function ingredientLine(m: Pick<MedicineSummary, 'ingredients'>) {
  return m.ingredients.map((i) => `${i.substanceName}${i.display ? ` ${i.display}` : ''}`).join(' + ');
}

export function MedicineCard({ medicine: m, compact, testID }: { medicine: MedicineSummary; compact?: boolean; testID?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const inCompare = useCompare((s) => s.items.some((i) => i.id === m.id));
  const toggle = useCompare((s) => s.toggle);
  const toast = useToast();

  const onCompare = () => {
    const r = toggle({ id: m.id, name: m.name });
    if (r === 'full') toast(t('compare.full'), 'info');
    else if (r === 'added') toast(t('medicine.inCompare'));
  };

  return (
    <Card testID={testID} onPress={() => router.push(`/medicine/${m.id}`)} accessibilityLabel={m.name} elevated style={{ width: compact ? 260 : undefined }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Pill size={22} color={colors.primary} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3" numberOfLines={2}>
            {m.name}
          </Text>
          <Text variant="small" color="textSecondary" numberOfLines={1}>
            {flag(m.countryCode)} {m.manufacturer ?? '—'}
          </Text>
        </View>
        <Pressable
          testID={testID ? `${testID}-compare` : undefined}
          accessibilityRole="button"
          accessibilityLabel={inCompare ? t('medicine.inCompare') : t('medicine.addCompare')}
          accessibilityState={{ selected: inCompare }}
          hitSlop={8}
          onPress={onCompare}
          style={{ width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: inCompare ? colors.primary : colors.surfaceAlt }}
        >
          {inCompare ? <Check size={18} color={colors.textOnPrimary} strokeWidth={2.6} /> : <GitCompareArrows size={17} color={colors.text} strokeWidth={2} />}
        </Pressable>
      </View>
      <Text variant="body" color="text" numberOfLines={compact ? 1 : 2} style={{ marginTop: spacing.md }}>
        {ingredientLine(m)}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
        {m.form ? <Badge label={m.form.name} /> : null}
        <Badge label={t(`rx.${m.prescription}`)} tone={m.prescription === 'RX' ? 'info' : 'neutral'} />
        {m.isDemo ? <Badge label={t('common.demoData')} tone="demo" /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
        {m.lowestPrice ? (
          <Text variant="bodyStrong" color="primary">
            {(m.lowestPrice.converted ? '≈ ' : '') + t('medicine.fromPrice', { price: formatMoney(m.lowestPrice.amount, m.lowestPrice.currency) })}
          </Text>
        ) : (
          <Text variant="small" color="textTertiary">
            {t('medicine.noPrice')}
          </Text>
        )}
        {m.rating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Star size={14} color={colors.warning} fill={colors.warning} />
            <Text variant="small">
              {m.rating.average.toFixed(1)} ({m.rating.count})
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
