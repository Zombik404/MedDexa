import { CloudOff, SearchX, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ApiError } from '@/api/client';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

interface EmptyProps {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  compact?: boolean;
}

export function EmptyState({ icon: Icon = SearchX, title, body, action, compact }: EmptyProps) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? spacing.xl : spacing.huge, paddingHorizontal: spacing.xl, gap: spacing.md }}>
      <View style={{ width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={28} color={colors.primary} strokeWidth={1.8} />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="body" color="textSecondary" align="center" style={{ maxWidth: 320 }}>
          {body}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="soft" size="sm" style={{ marginTop: spacing.xs }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  const apiError = error instanceof ApiError ? error : null;
  if (apiError?.status === 404) {
    return <EmptyState icon={SearchX} title={t('errors.notFoundTitle')} body={t('errors.notFoundBody')} compact={compact} />;
  }
  const network = apiError?.isNetwork;
  return (
    <EmptyState
      icon={network ? CloudOff : TriangleAlert}
      title={network ? t('errors.networkTitle') : t('errors.title')}
      body={network ? t('errors.networkBody') : t('errors.body')}
      action={onRetry ? { label: t('common.retry'), onPress: onRetry } : undefined}
      compact={compact}
    />
  );
}
