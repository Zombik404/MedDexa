import { CircleCheck, Info } from 'lucide-react-native';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, spacing } from '@/theme/tokens';
import { Text } from './Text';

type Tone = 'success' | 'info';
const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ id: number; message: string; tone: Tone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((message: string, tone: Tone = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  const Icon = toast?.tone === 'info' ? Info : CircleCheck;
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: insets.bottom + 90, alignItems: 'center' }}>
          <Animated.View
            key={toast.id}
            entering={FadeInDown.duration(220)}
            exiting={FadeOutDown.duration(180)}
            accessibilityLiveRegion="polite"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.text, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, ...shadow(colors, 3) }}
          >
            <Icon size={18} color={colors.background} />
            <Text variant="small" style={{ color: colors.background, fontFamily: 'Manrope_600SemiBold' }}>
              {toast.message}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
