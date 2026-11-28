import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'mint' | 'onDark';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', size = 'md', icon: Icon, loading, disabled, full, style, accessibilityHint, testID }: Props) {
  const { colors } = useTheme();
  const variants: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.textOnPrimary },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.primary },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    soft: { bg: colors.primarySoft, fg: colors.primary },
    mint: { bg: palette.mint400, fg: palette.forest900 },
    onDark: { bg: 'transparent', fg: '#FFFFFF' },
  };
  const p = variants[variant];
  const height = size === 'md' ? 52 : 40;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal: size === 'md' ? spacing.xl : spacing.lg,
          backgroundColor: p.bg,
          borderColor: p.border ?? 'transparent',
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          alignSelf: full ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon size={size === 'md' ? 18 : 16} color={p.fg} strokeWidth={2.2} /> : null}
          <Text variant="button" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: p.fg, fontSize: size === 'md' ? 15 : 14, flexShrink: 1 }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
