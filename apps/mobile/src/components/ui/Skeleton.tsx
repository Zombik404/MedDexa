import { useEffect } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export function Skeleton({ width = '100%', height = 14, round = radius.sm, style }: { width?: DimensionValue; height?: number; round?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width, height, borderRadius: round, backgroundColor: colors.skeleton }, animated, style]} />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Loading" style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm }}>
      <Skeleton width="60%" height={18} />
      {Array.from({ length: lines - 1 }, (_, i) => (
        <Skeleton key={i} width={i % 2 ? '45%' : '85%'} />
      ))}
    </View>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.md }}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}
