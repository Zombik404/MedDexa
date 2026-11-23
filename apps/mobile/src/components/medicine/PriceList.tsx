import type { PriceComparisonView } from '@meddexa/shared';
import { Clock, FlaskConical, Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge, Text } from '@/components/ui';
import { countryName, flag, formatDate, formatMoney } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const AVAILABILITY_TONE = { IN_STOCK: 'success', LIMITED: 'warning', OUT_OF_STOCK: 'danger', UNKNOWN: 'neutral' } as const;

export function PriceList({ data, limit = 8 }: { data: PriceComparisonView; limit?: number }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (!data.offers.length) {
    return (
      <View style={{ padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, gap: spacing.xs }}>
        <Text variant="bodyStrong">{t('prices.noData')}</Text>
        <Text variant="small" color="textSecondary">
          {t('prices.notPurchase')}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {data.offers.slice(0, limit).map((o) => (
        <View key={o.id} testID="price-row" style={{ padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6, opacity: o.stale ? 0.75 : 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {flag(o.countryCode)} {o.pharmacy ? o.pharmacy.name : t('prices.nationalList')}
              </Text>
              <Text variant="small" color="textSecondary" numberOfLines={1}>
                {[o.pharmacy?.city, countryName(o.countryCode)].filter(Boolean).join(', ')} · {t(`prices.type.${o.priceType}`)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="h3" color="primary">
                {formatMoney(o.local.amount, o.local.currency)}
              </Text>
              {o.converted ? (
                <Text variant="small" color="textSecondary">
                  {t('prices.converted', { price: formatMoney(o.converted.amount, o.converted.currency) })}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {o.pharmacy ? <Badge label={t(`availability.${o.availability}`)} tone={AVAILABILITY_TONE[o.availability]} /> : null}
            {o.stale ? <Badge label={t('prices.stale')} tone="warning" icon={Clock} /> : null}
            {o.provenance.isDemo ? <Badge label={t('common.demoData')} tone="demo" icon={FlaskConical} /> : null}
            {o.perUnit ? (
              <Text variant="small" color="textTertiary">
                {t('prices.perUnit', { price: formatMoney(o.perUnit.amount, o.perUnit.currency), unit: o.perUnit.per })}
              </Text>
            ) : null}
            <Text variant="small" color="textTertiary">
              {t('prices.observed', { date: formatDate(o.observedAt) })}
            </Text>
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.infoSoft }}>
        <Info size={16} color={colors.info} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="small" color="text">
            {t('prices.notPurchase')}
          </Text>
          {data.rates ? (
            <Text variant="small" color="textSecondary">
              {t('prices.convertedNote')} {t('prices.rates', { source: data.rates.source, date: formatDate(data.rates.date) })}
              {data.rates.isFallback ? ` ${t('prices.fallbackRates')}` : ''}
            </Text>
          ) : null}
          {data.countriesWithoutData.length ? (
            <Text variant="small" color="textSecondary">
              {t('prices.noDataCountries', { countries: data.countriesWithoutData.map((c) => flag(c)).join(' ') })}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
