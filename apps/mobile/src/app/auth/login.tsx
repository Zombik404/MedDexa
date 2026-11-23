import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@meddexa/shared';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useAuthMutations } from '@/api/hooks';
import { Screen } from '@/components/Screen';
import { Button, LogoMark, Text, TextField } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useSyncGuestData } from '@/hooks/useSyncGuestData';
import { apiErrorMessage, fieldError } from '@/lib/forms';
import { spacing } from '@/theme/tokens';

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { login } = useAuthMutations();
  const sync = useSyncGuestData();
  const { control, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    await login.mutateAsync(values);
    await sync();
    toast(t('auth.signInTitle'));
    router.back();
  });

  return (
    <Screen topInset={false}>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          <LogoMark size={48} />
          <Text variant="h1">{t('auth.signInTitle')}</Text>
          <Text color="textSecondary">{t('auth.subtitle')}</Text>
        </View>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField testID="login-email" label={t('auth.email')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" error={fieldError(t, formState.errors.email?.message)} />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField testID="login-password" label={t('auth.password')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={() => void onSubmit()} error={fieldError(t, formState.errors.password?.message)} />
          )}
        />
        {login.error ? (
          <Text color="danger" accessibilityLiveRegion="assertive">
            {apiErrorMessage(t, login.error)}
          </Text>
        ) : null}
        <Button testID="login-submit" label={t('common.signIn')} onPress={onSubmit} loading={formState.isSubmitting} full />
        <Pressable accessibilityRole="link" onPress={() => router.push('/auth/forgot')}>
          <Text color="primary" align="center" variant="bodyStrong">
            {t('auth.forgot')}
          </Text>
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Text color="textSecondary">{t('auth.noAccount')}</Text>
          <Pressable accessibilityRole="link" onPress={() => router.replace('/auth/register')}>
            <Text color="primary" variant="bodyStrong">
              {t('common.createAccount')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
