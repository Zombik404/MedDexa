import type { IngredientView } from '@meddexa/shared';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Active ingredients with exact quantities and, for salts, the active moiety. */
export function IngredientList({ ingredients }: { ingredients: IngredientView[] }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (!ingredients.length) return <Text color="textSecondary">{t('common.unknown')}</Text>;
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      {ingredients.map((i, idx) => (
        <View
          key={i.substanceId}
          accessible
          accessibilityLabel={`${i.substanceName} ${i.display ?? t('common.unknown')}`}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: idx ? 1 : 0, borderTopColor: colors.border }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" style={{ textTransform: 'capitalize' }}>
              {i.substanceName}
            </Text>
            {i.moietyName && i.moietyName !== i.substanceName ? (
              <Text variant="small" color="textSecondary">
                {i.basis === 'MOIETY' ? `= ${i.moietyName}` : `${i.moietyName} (salt)`}
              </Text>
            ) : null}
          </View>
          <Text variant="mono" color="primary">
            {i.display ?? '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}
