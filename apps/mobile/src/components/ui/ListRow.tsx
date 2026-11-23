import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

interface Props {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  danger?: boolean;
  last?: boolean;
  testID?: string;
}

export function ListRow({ icon: Icon, title, subtitle, value, onPress, right, toggle, danger, last, testID }: Props) {
  const { colors } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      {Icon ? (
        <View style={{ width: 34, height: 34, borderRadius: radius.md, backgroundColor: danger ? colors.dangerSoft : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={danger ? colors.danger : colors.primary} strokeWidth={2} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" style={{ color: danger ? colors.danger : colors.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="small" color="textSecondary">
          {value}
        </Text>
      ) : null}
      {right}
      {toggle ? (
        <Switch value={toggle.value} onValueChange={toggle.onChange} trackColor={{ true: colors.primary, false: colors.borderStrong }} thumbColor="#FFFFFF" accessibilityLabel={title} />
      ) : onPress ? (
        <ChevronRight size={18} color={colors.textTertiary} />
      ) : null}
    </View>
  );
  if (!onPress || toggle) return <View testID={testID}>{content}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
      {content}
    </Pressable>
  );
}

export function ListGroup({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>{children}</View>;
}
