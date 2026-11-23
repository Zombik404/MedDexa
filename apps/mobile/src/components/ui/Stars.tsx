import { Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${value.toFixed(1)} / 5`} style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={colors.warning} fill={i <= Math.round(value) ? colors.warning : 'transparent'} strokeWidth={1.8} />
      ))}
    </View>
  );
}

export function StarInput({ value, onChange, size = 30, label }: { value: number; onChange: (v: number) => void; size?: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 1, max: 5, now: value }} style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${label}: ${i}`} hitSlop={4} onPress={() => onChange(i)}>
          <Star size={size} color={colors.warning} fill={i <= value ? colors.warning : 'transparent'} strokeWidth={1.6} />
        </Pressable>
      ))}
    </View>
  );
}
