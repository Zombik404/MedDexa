import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useAuthMutations } from '@/api/hooks';
import { Screen } from '@/components/Screen';
import { Button, Text, TextField } from '@/components/ui';
import { spacing } from '@/theme/tokens';

export default function Forgot() {
  const { t } = useTranslation();
  const { forgot } = useAuthMutations();
  const [email, setEmail] = useState('');
  const valid = /\S+@\S+\.\S+/.test(email);
  return (
    <Screen topInset={false}>
      <View style={{ gap: spacing.xl }}>
        <Text variant="h1">{t('auth.forgotTitle')}</Text>
        <Text color="textSecondary">{t('auth.forgotBody')}</Text>
        <TextField label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        {forgot.isSuccess ? (
          <Text color="success" accessibilityLiveRegion="polite">
            {t('auth.linkSent')}
          </Text>
        ) : null}
        <Button label={t('auth.sendLink')} onPress={() => forgot.mutate(email.trim().toLowerCase())} loading={forgot.isPending} disabled={!valid || forgot.isSuccess} full />
      </View>
    </Screen>
  );
}
