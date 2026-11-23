import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, spacing } from '@/theme/tokens';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  tone?: 'surface' | 'alt' | 'primary' | 'soft';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Card({ children, onPress, padded = true, elevated = false, tone = 'surface', style, accessibilityLabel, testID }: Props) {
  const { colors, dark } = useTheme();
  const bg = { surface: colors.surface, alt: colors.surfaceAlt, primary: colors.primary, soft: colors.primarySoft }[tone];
  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius.xl,
    padding: padded ? spacing.lg : 0,
    borderWidth: tone === 'surface' ? 1 : 0,
    borderColor: colors.border,
    ...(elevated && !dark ? shadow(colors, 1) : {}),
  };
  if (!onPress) return <View testID={testID} style={[base, style]}>{children}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, { opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.992 : 1 }] }, style]}
    >
      {children}
    </Pressable>
  );
}
