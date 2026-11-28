import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Soft entrance for a screen's content: fades in while rising a few pixels. On iOS/Android
 * the native stack already slides screens, so by default this only runs on the web, where
 * page changes would otherwise be an instant cut. Skipped when the user asks for reduced motion.
 */
export function FadeIn({ children, style, always = false, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; always?: boolean; delay?: number }) {
  const enabled = always || Platform.OS === 'web';
  const [progress] = useState(() => new Animated.Value(enabled ? 0 : 1));
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => {
        if (cancelled) return;
        if (r) {
          setReduce(true);
          progress.setValue(1);
          return;
        }
        Animated.timing(progress, { toValue: 1, duration: 240, delay, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
      })
      .catch(() => progress.setValue(1));
    return () => {
      cancelled = true;
    };
  }, [enabled, delay, progress]);

  if (!enabled || reduce) return <Animated.View style={style}>{children}</Animated.View>;
  return (
    <Animated.View
      style={[
        style,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}
