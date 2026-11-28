import { forwardRef, type ComponentRef } from 'react';
import { Platform, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<ComponentRef<typeof TextInput>, Props>(function TextField({ label, error, hint, style, multiline, ...rest }, ref) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="small" color="textSecondary" style={{ fontFamily: fonts.semibold }}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textTertiary}
        maxFontSizeMultiplier={1.5}
        multiline={multiline}
        style={[
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          {
            minHeight: multiline ? 120 : 52,
            paddingHorizontal: spacing.lg,
            paddingTop: multiline ? spacing.md : 0,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fonts.medium,
            fontSize: 16,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="small" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color="textTertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
