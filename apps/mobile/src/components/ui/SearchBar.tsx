import { Search, X } from 'lucide-react-native';
import { forwardRef, type ComponentRef } from 'react';
import { Platform, Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, shadow, spacing } from '@/theme/tokens';
import { Text } from './Text';

interface Props extends Omit<TextInputProps, 'style'> {
  /** When set, the bar is a button that navigates (home screen). */
  onPressFake?: () => void;
  onClear?: () => void;
  large?: boolean;
}

export const SearchBar = forwardRef<ComponentRef<typeof TextInput>, Props>(function SearchBar({ onPressFake, onClear, large, value, placeholder, ...rest }, ref) {
  const { colors, dark } = useTheme();
  const height = large ? 58 : 48;
  const container = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    height,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: large ? colors.borderStrong : colors.border,
    ...(large && !dark ? shadow(colors, 2) : {}),
  };
  if (onPressFake) {
    return (
      <Pressable testID="home-search" accessibilityRole="search" accessibilityLabel={placeholder} onPress={onPressFake} style={({ pressed }) => [container, { opacity: pressed ? 0.9 : 1 }]}>
        <Search size={large ? 22 : 19} color={colors.primary} strokeWidth={2.2} />
        <Text variant="body" color="textTertiary" numberOfLines={1} style={{ flex: 1, fontSize: large ? 16 : 15 }}>
          {placeholder}
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={container}>
      <Search size={19} color={colors.primary} strokeWidth={2.2} style={{ flexShrink: 0 }} />
      <TextInput
        ref={ref}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityRole="search"
        maxFontSizeMultiplier={1.5}
        style={[{ flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 16, color: colors.text, height: '100%' }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
        {...rest}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear" hitSlop={10} onPress={onClear}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} color={colors.textSecondary} strokeWidth={2.4} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
});
