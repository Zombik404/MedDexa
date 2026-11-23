import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: 3 }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: selected ? colors.surface : 'transparent' }}
          >
            <Text variant="small" style={{ color: selected ? colors.text : colors.textSecondary, fontFamily: selected ? 'Manrope_700Bold' : 'Manrope_600SemiBold' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
