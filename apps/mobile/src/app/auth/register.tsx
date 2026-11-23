import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@meddexa/shared';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useAuthMutations } from '@/api/hooks';
import { Screen } from '@/components/Screen';
import { Button, Text, TextField } from '@/components/ui';
import { useSyncGuestData } from '@/hooks/useSyncGuestData';
import i18n from '@/i18n';
import { apiErrorMessage, fieldError } from '@/lib/forms';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function Register() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { register } = useAuthMutations();
  const sync = useSyncGuestData();
  const { control, handleSubmit, formState } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', displayName: '', acceptTerms: false as unknown as true },
  });

  const onSubmit = handleSubmit(async (values) => {
    await register.mutateAsync({ ...values, displayName: values.displayName || undefined, locale: i18n.language });
    await sync();
    router.back();
  });

  return (
    <Screen topInset={false}>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="h1">{t('auth.signUpTitle')}</Text>
          <Text color="textSecondary">{t('auth.subtitle')}</Text>
        </View>
        <Controller control={control} name="displayName" render={({ field }) => <TextField label={t('auth.displayName')} value={field.value ?? ''} onChangeText={field.onChange} autoComplete="name" textContentType="name" />} />
        <Controller
          control={control}
          name="email"
          render={({ field }) => <TextField testID="register-email" label={t('auth.email')} value={field.value} onChangeText={field.onChange} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={fieldError(t, formState.errors.email?.message)} />}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField testID="register-password" label={t('auth.password')} value={field.value} onChangeText={field.onChange} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={t('auth.errors.passwordLength')} error={fieldError(t, formState.errors.password?.message)} />
          )}
        />
        <Controller
          control={control}
          name="acceptTerms"
          render={({ field }) => (
            <View style={{ gap: 4 }}>
              <Pressable testID="register-terms" accessibilityRole="checkbox" accessibilityState={{ checked: !!field.value }} onPress={() => field.onChange(!field.value)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: field.value ? colors.primary : colors.borderStrong, backgroundColor: field.value ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {field.value ? <Check size={15} color={colors.textOnPrimary} strokeWidth={3} /> : null}
                </View>
                <Text style={{ flex: 1 }}>{t('auth.terms')}</Text>
              </Pressable>
              {formState.errors.acceptTerms ? <Text variant="small" color="danger">{t('auth.errors.terms')}</Text> : null}
            </View>
          )}
        />
        {register.error ? <Text color="danger">{apiErrorMessage(t, register.error)}</Text> : null}
        <Button testID="register-submit" label={t('common.createAccount')} onPress={onSubmit} loading={formState.isSubmitting} full />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Text color="textSecondary">{t('auth.haveAccount')}</Text>
          <Pressable accessibilityRole="link" onPress={() => router.replace('/auth/login')}>
            <Text color="primary" variant="bodyStrong">
              {t('common.signIn')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
