import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { Text } from './ui';

interface Props {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  scroll?: boolean;
  /** Screens inside a native stack header don't need the top inset. */
  topInset?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, title, subtitle, right, scroll = true, topInset = true, refreshing, onRefresh, contentStyle }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const header = title ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xl, gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text variant="h1" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" color="textSecondary" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  ) : null;
  const padding = { paddingTop: (topInset ? insets.top : 0) + spacing.lg, paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 110 };
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: padding.paddingTop }]}>
        <View style={{ paddingHorizontal: spacing.xl }}>{header}</View>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {header}
      {children}
    </ScrollView>
  );
}
