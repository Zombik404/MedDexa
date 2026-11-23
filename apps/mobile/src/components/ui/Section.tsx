import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '@/theme/tokens';
import { Text } from './Text';

export function SectionHeader({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }, style]}>
      <Text variant="h3" accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text variant="small" color="primary" style={{ fontFamily: 'Manrope_700Bold' }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Section({ title, action, onAction, children, style }: { title?: string; action?: string; onAction?: () => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginBottom: spacing.xxl }, style]}>
      {title ? <SectionHeader title={title} action={action} onAction={onAction} /> : null}
      {children}
    </View>
  );
}
