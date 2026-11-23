import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card, Text, Wordmark } from '@/components/ui';
import { spacing } from '@/theme/tokens';

export default function About() {
  const { t } = useTranslation();
  return (
    <Screen topInset={false}>
      <View style={{ gap: spacing.xl }}>
        <Wordmark size={26} />
        <Text variant="h3" color="textSecondary">
          {t('common.tagline')}
        </Text>
        <Card>
          <Text variant="h3" style={{ marginBottom: spacing.sm }}>
            {t('onboarding.disclaimerTitle')}
          </Text>
          <Text>{t('onboarding.disclaimerBody')}</Text>
        </Card>
        <Text variant="small" color="textSecondary">
          {t('prices.notPurchase')}
        </Text>
        <Text variant="small" color="textSecondary">
          {t('pharmacies.coverage')}
        </Text>
        <Text variant="small" color="textTertiary">
          {t('profile.version', { version: Constants.expoConfig?.version ?? '0.1.0' })}
        </Text>
      </View>
    </Screen>
  );
}
