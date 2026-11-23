import type { LucideIcon } from 'lucide-react-native';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

interface Props {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  active?: boolean;
  tone?: 'surface' | 'plain' | 'primary';
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function IconButton({ icon: Icon, label, onPress, active, tone = 'surface', size = 40, style, testID }: Props) {
  const { colors } = useTheme();
  const bg = tone === 'primary' || active ? colors.primary : tone === 'surface' ? colors.surface : 'transparent';
  const fg = tone === 'primary' || active ? colors.textOnPrimary : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          borderWidth: tone === 'surface' && !active ? 1 : 0,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Icon size={size * 0.47} color={fg} strokeWidth={2} />
    </Pressable>
  );
}
