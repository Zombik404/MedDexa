import type { Assessment, CompositionClass, Difference } from '@meddexa/shared';
import { CircleAlert, CircleCheck, CircleHelp, CircleMinus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export function useAssessmentTone(a: Assessment) {
  const { colors } = useTheme();
  return {
    POTENTIALLY_EQUIVALENT: { fg: colors.success, bg: colors.successSoft, Icon: CircleCheck },
    IMPORTANT_DIFFERENCES: { fg: colors.danger, bg: colors.dangerSoft, Icon: CircleAlert },
    INSUFFICIENT_DATA: { fg: colors.warning, bg: colors.warningSoft, Icon: CircleHelp },
    NOT_COMPARABLE: { fg: colors.textSecondary, bg: colors.surfaceAlt, Icon: CircleMinus },
  }[a];
}

export function AssessmentBanner({ assessment, composition, critical, major }: { assessment: Assessment; composition: CompositionClass; critical: number; major: number }) {
  const { t } = useTranslation();
  const tone = useAssessmentTone(assessment);
  return (
    <View testID="assessment-banner" accessibilityRole="summary" style={{ backgroundColor: tone.bg, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <tone.Icon size={22} color={tone.fg} strokeWidth={2.2} />
        <Text variant="h3" style={{ color: tone.fg, flex: 1 }}>
          {t(`assessment.${assessment}`)}
        </Text>
      </View>
      <Text variant="small" color="text">
        {t(`composition.${composition}`)}
        {critical ? ` · ${t('compare.critical', { count: critical })}` : ''}
        {major ? ` · ${t('compare.major', { count: major })}` : ''}
      </Text>
      <Text variant="small" color="textSecondary">
        {t(`assessment.hint.${assessment}`)}
      </Text>
    </View>
  );
}

const SEVERITY_TONE = { critical: 'danger', major: 'warning', minor: 'info', info: 'neutral' } as const;

export function DifferenceList({ differences, labels }: { differences: Difference[]; labels: (code: 'ref' | 'other', d: Difference) => string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!differences.length) return <Text color="textSecondary">{t('compare.noDifferences')}</Text>;
  return (
    <View style={{ gap: spacing.sm }}>
      {differences.map((d, i) => (
        <View key={`${d.code}-${d.substanceId ?? i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <View style={{ marginTop: 2 }}>
            <Badge label={t(`severity.${d.severity}`)} tone={SEVERITY_TONE[d.severity]} />
          </View>
          <Text variant="small" style={{ flex: 1, color: colors.text }}>
            {t(`diff.${d.code}`, { ref: labels('ref', d), other: labels('other', d) })}
          </Text>
        </View>
      ))}
    </View>
  );
}
