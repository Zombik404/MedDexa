import type { AttributeRow, ComparisonResult, IngredientCell, MedicineSummary, PriceOfferView } from '@meddexa/shared';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { Text } from '@/components/ui';
import { countryName, formatMoney } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, spacing } from '@/theme/tokens';

const LABEL_W = 116;
const COL_W = 150;

/**
 * Side-by-side matrix. The reference column comes first; cells that differ from the
 * reference are highlighted, and missing ingredients are called out explicitly.
 */
export function CompareMatrix({ medicines, result, prices }: { medicines: MedicineSummary[]; result: ComparisonResult; prices: Record<string, PriceOfferView | null> }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const cellTone = (status: IngredientCell['status']) => {
    switch (status) {
      case 'REFERENCE':
      case 'SAME':
        return { bg: colors.surface, fg: colors.text };
      case 'MISSING':
      case 'ADDITIONAL':
        return { bg: colors.dangerSoft, fg: colors.danger };
      case 'UNKNOWN_QUANTITY':
      case 'INCOMPARABLE_UNITS':
        return { bg: colors.warningSoft, fg: colors.warning };
      default:
        return { bg: colors.warningSoft, fg: colors.warning };
    }
  };

  const attrValue = (row: AttributeRow, v: string | null) => {
    if (v == null) return '—';
    if (row.key === 'release') return t(`release.${v}`);
    if (row.key === 'prescription') return t(`rx.${v}`);
    if (row.key === 'route') return t(`route.${v}`, { defaultValue: v });
    if (row.key === 'country') return countryName(v);
    return v;
  };

  const Row = ({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) => (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
      <View style={{ width: LABEL_W, padding: spacing.sm, backgroundColor: highlight ? colors.warningSoft : colors.surfaceAlt, justifyContent: 'center' }}>
        <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase' }} numberOfLines={3}>
          {label}
        </Text>
      </View>
      {children}
    </View>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.xl }}>
      <View testID="compare-matrix" style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.surface }}>
        {/* Header */}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: LABEL_W, backgroundColor: colors.surfaceAlt }} />
          {medicines.map((m, i) => (
            <View key={m.id} style={{ width: COL_W, padding: spacing.sm, backgroundColor: i === 0 ? colors.primarySoft : colors.surface }}>
              <Text variant="caption" color={i === 0 ? 'primary' : 'textTertiary'} style={{ textTransform: 'uppercase' }}>
                {i === 0 ? t('compare.reference') : `#${i + 1}`}
              </Text>
              <Text variant="small" style={{ fontFamily: fonts.bold }} numberOfLines={3}>
                {m.name}
              </Text>
            </View>
          ))}
        </View>

        {/* Ingredients */}
        {result.ingredientRows.map((row) => (
          <Row key={row.key} label={row.name} highlight={!row.allSame}>
            {row.cells.map((c, i) => {
              const tone = cellTone(c.status);
              return (
                <View key={i} accessible accessibilityLabel={`${row.name}: ${c.display ?? t('cell.MISSING')} — ${t(`cell.${c.status}`)}`} style={{ width: COL_W, padding: spacing.sm, backgroundColor: tone.bg, gap: 2 }}>
                  <Text variant="mono" style={{ color: c.present ? colors.text : tone.fg }}>
                    {c.present ? c.display ?? '?' : '—'}
                  </Text>
                  {c.present && c.substanceName && c.substanceName !== row.name ? (
                    <Text variant="small" color="textSecondary" numberOfLines={1}>
                      {c.substanceName}
                    </Text>
                  ) : null}
                  {c.status !== 'REFERENCE' && c.status !== 'SAME' ? (
                    <Text variant="caption" style={{ color: tone.fg }}>
                      {t(`cell.${c.status}`)}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </Row>
        ))}

        {/* Attributes */}
        {result.attributeRows.map((row) => (
          <Row key={row.key} label={t(`compare.attr.${row.key}`)} highlight={!row.allSame}>
            {row.values.map((v, i) => {
              const differs = i > 0 && v !== row.values[0];
              return (
                <View key={i} style={{ width: COL_W, padding: spacing.sm, backgroundColor: differs ? colors.warningSoft : colors.surface }}>
                  <Text variant="small" style={{ color: differs ? colors.warning : colors.text, fontFamily: differs ? fonts.bold : fonts.medium }} numberOfLines={3}>
                    {attrValue(row, v)}
                  </Text>
                </View>
              );
            })}
          </Row>
        ))}

        {/* Prices */}
        <Row label={t('compare.price')}>
          {medicines.map((m) => {
            const p = prices[m.id];
            const shown = p?.converted ?? p?.local;
            return (
              <View key={m.id} style={{ width: COL_W, padding: spacing.sm, gap: 2 }}>
                <Text variant="bodyStrong" color={p ? 'primary' : 'textTertiary'}>
                  {shown ? `${p?.converted ? '≈ ' : ''}${formatMoney(shown.amount, shown.currency)}` : '—'}
                </Text>
                {p?.perUnit ? (
                  <Text variant="small" color="textSecondary">
                    {formatMoney(p.perUnit.amount, p.perUnit.currency)} {t('compare.perUnit', { unit: p.perUnit.per })}
                  </Text>
                ) : null}
                {p ? (
                  <Text variant="small" color="textTertiary" numberOfLines={1}>
                    {countryName(p.countryCode)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </Row>
      </View>
    </ScrollView>
  );
}
