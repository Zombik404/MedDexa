import type { IngredientView } from '@meddexa/shared';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Active ingredients with exact quantities and, for salts, the active moiety. */
export function IngredientList({ ingredients, onPressIngredient }: { ingredients: IngredientView[]; onPressIngredient?: (i: IngredientView) => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (!ingredients.length) return <Text color="textSecondary">{t('common.unknown')}</Text>;
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      {ingredients.map((i, idx) => (
        <Pressable
          key={i.substanceId}
          testID={`ingredient-${idx}`}
          disabled={!onPressIngredient}
          onPress={() => onPressIngredient?.(i)}
          accessibilityRole={onPressIngredient ? 'button' : undefined}
          accessibilityLabel={`${i.substanceName} ${i.display ?? t('common.unknown')}`}
          accessibilityHint={onPressIngredient ? t('medicine.ingredientHint') : undefined}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, padding: spacing.lg, backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderTopWidth: idx ? 1 : 0, borderTopColor: colors.border })}
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
            {i.display ?? t('medicine.amountUnknown')}
          </Text>
          {onPressIngredient ? <ChevronRight size={16} color={colors.textTertiary} /> : null}
        </Pressable>
      ))}
    </View>
  );
}
