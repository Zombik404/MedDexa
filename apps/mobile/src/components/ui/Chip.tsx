import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  testID?: string;
}

export function Chip({ label, selected, onPress, icon: Icon, testID }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 36,
        paddingHorizontal: spacing.md + 2,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {Icon ? <Icon size={15} color={selected ? colors.textOnPrimary : colors.textSecondary} strokeWidth={2.2} /> : null}
      <Text variant="small" style={{ color: selected ? colors.textOnPrimary : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}
