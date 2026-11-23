import type { Provenance as P } from '@meddexa/shared';
import { BadgeCheck, Clock, FlaskConical, ShieldQuestion } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { Badge } from './Badge';
import { Text } from './Text';

export function VerificationBadge({ provenance }: { provenance: Pick<P, 'verification' | 'isDemo'> }) {
  const { t } = useTranslation();
  if (provenance.isDemo) return <Badge tone="demo" icon={FlaskConical} label={t('common.demoData')} />;
  if (provenance.verification === 'VERIFIED') return <Badge tone="success" icon={BadgeCheck} label={t('common.verified')} />;
  if (provenance.verification === 'OUTDATED') return <Badge tone="warning" icon={Clock} label={t('common.outdated')} />;
  return <Badge tone="neutral" icon={ShieldQuestion} label={t('common.unverified')} />;
}

/** Source, sync date and verification of a record — shown wherever external data appears. */
export function ProvenanceLine({ provenance }: { provenance: P }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
      <VerificationBadge provenance={provenance} />
      <Text variant="small" color="textTertiary" style={{ flexShrink: 1 }}>
        {t('common.source')}: {provenance.sourceName}
        {provenance.syncedAt ? ` · ${t('common.updated', { date: formatDate(provenance.syncedAt) })}` : ''}
      </Text>
      <View style={{ width: 0, height: 0, backgroundColor: colors.border }} />
    </View>
  );
}
