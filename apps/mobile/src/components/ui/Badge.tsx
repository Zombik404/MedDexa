import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'demo';

export function Badge({ label, tone = 'neutral', icon: Icon }: { label: string; tone?: BadgeTone; icon?: LucideIcon }) {
  const { colors } = useTheme();
  const map: Record<BadgeTone, [string, string]> = {
    neutral: [colors.surfaceAlt, colors.textSecondary],
    primary: [colors.primarySoft, colors.primary],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
    info: [colors.infoSoft, colors.info],
    demo: [colors.warningSoft, colors.warning],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
      {Icon ? <Icon size={12} color={fg} strokeWidth={2.4} /> : null}
      <Text variant="caption" style={{ color: fg, letterSpacing: 0.2 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
