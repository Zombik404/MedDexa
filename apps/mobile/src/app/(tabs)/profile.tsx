import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from '@meddexa/shared';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Bell, Clock, Coins, GitCompareArrows, Heart, Info, Languages, LogOut, Search, Shield, ShieldCheck, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useLogout, useSignedIn, useUpdatePreferences } from '@/api/hooks';
import { Screen } from '@/components/Screen';
import { Button, Card, LogoMark, Segmented, Sheet, Text } from '@/components/ui';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { deviceLanguage } from '@/i18n';
import { usePreferences, type ThemePreference } from '@/store/preferences';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const signedIn = useSignedIn();
  const user = useSession((s) => s.user);
  const prefs = usePreferences();
  const updateRemote = useUpdatePreferences();
  const logout = useLogout();
  const [sheet, setSheet] = useState<null | 'language' | 'currency'>(null);

  const setPref = (patch: Parameters<typeof prefs.set>[0]) => {
    prefs.set(patch);
    if (signedIn) {
      const { language, currency, theme } = patch;
      updateRemote.mutate({ ...(language ? { language } : {}), ...(currency ? { currency } : {}), ...(theme ? { theme } : {}) });
    }
  };

  const languageName = SUPPORTED_LANGUAGES.find((l) => l.code === (prefs.language ?? deviceLanguage()))?.name;

  return (
    <Screen title={t('profile.title')}>
      {signedIn && user ? (
        <Card style={{ marginBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="h2" color="primary">
                {(user.displayName ?? user.email)[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3">{user.displayName ?? user.email.split('@')[0]}</Text>
              <Text variant="small" color="textSecondary" numberOfLines={1}>
                {t('profile.signedInAs', { email: user.email })}
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <Card tone="soft" style={{ marginBottom: spacing.xxl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <LogoMark size={40} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">{t('profile.guestTitle')}</Text>
              <Text variant="small" color="textSecondary">
                {t('profile.guestBody')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button testID="profile-signin" label={t('common.signIn')} onPress={() => router.push('/auth/login')} style={{ flex: 1 }} />
            <Button label={t('common.createAccount')} variant="secondary" onPress={() => router.push('/auth/register')} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      <Text variant="caption" color="textTertiary" style={{ textTransform: 'uppercase', marginBottom: spacing.sm }}>
        {t('profile.library')}
      </Text>
      <ListGroup>
        <ListRow icon={Heart} title={t('profile.favorites')} onPress={() => router.push('/profile/favorites')} />
        <ListRow icon={GitCompareArrows} title={t('profile.comparisons')} onPress={() => router.push('/profile/history')} />
        <ListRow icon={Search} title={t('profile.searches')} onPress={() => router.push({ pathname: '/profile/history', params: { tab: 'search' } })} />
        <ListRow icon={Clock} title={t('profile.recent')} onPress={() => router.push('/profile/recent')} last />
      </ListGroup>

      <Text variant="caption" color="textTertiary" style={{ textTransform: 'uppercase', marginTop: spacing.xxl, marginBottom: spacing.sm }}>
        {t('profile.settings')}
      </Text>
      <ListGroup>
        {signedIn ? <ListRow icon={UserRound} title={t('profile.account')} onPress={() => router.push('/profile/account')} /> : null}
        <ListRow testID="row-language" icon={Languages} title={t('profile.language')} value={prefs.language ? languageName : `${t('profile.systemLanguage')} (${languageName})`} onPress={() => setSheet('language')} />
        <ListRow testID="row-currency" icon={Coins} title={t('profile.currency')} value={prefs.currency} onPress={() => setSheet('currency')} />
        <ListRow icon={Bell} title={t('profile.notifications')} onPress={() => router.push('/profile/settings')} />
        <ListRow icon={Shield} title={t('profile.privacy')} onPress={() => router.push('/profile/privacy')} last />
      </ListGroup>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Text variant="small" color="textSecondary">
          {t('profile.appearance')}
        </Text>
        <Segmented<ThemePreference>
          value={prefs.theme}
          onChange={(theme) => setPref({ theme })}
          options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`profile.theme.${v}`) }))}
        />
      </View>

      <View style={{ marginTop: spacing.xxl }}>
        <ListGroup>
          <ListRow icon={ShieldCheck} title={t('profile.disclaimer')} onPress={() => router.push('/profile/about')} />
          <ListRow icon={Info} title={t('profile.about')} value={t('profile.version', { version: Constants.expoConfig?.version ?? '0.1.0' })} onPress={() => router.push('/profile/about')} last={!signedIn} />
          {signedIn ? <ListRow icon={LogOut} title={t('common.signOut')} danger onPress={() => void logout()} last /> : null}
        </ListGroup>
      </View>

      <Sheet visible={sheet === 'language'} onClose={() => setSheet(null)} title={t('profile.language')}>
        <ListGroup>
          <ListRow title={t('profile.systemLanguage')} right={prefs.language === null ? <Dot /> : null} onPress={() => { prefs.set({ language: null }); setSheet(null); }} />
          {SUPPORTED_LANGUAGES.map((l, i) => (
            <ListRow
              key={l.code}
              testID={`lang-${l.code}`}
              title={l.name}
              value={l.code.toUpperCase()}
              right={prefs.language === l.code ? <Dot /> : null}
              onPress={() => {
                setPref({ language: l.code });
                setSheet(null);
              }}
              last={i === SUPPORTED_LANGUAGES.length - 1}
            />
          ))}
        </ListGroup>
      </Sheet>

      <Sheet visible={sheet === 'currency'} onClose={() => setSheet(null)} title={t('profile.currency')}>
        <Text variant="small" color="textSecondary">
          {t('profile.currencyNote')}
        </Text>
        <ListGroup>
          {SUPPORTED_CURRENCIES.map((c, i) => (
            <ListRow
              key={c}
              testID={`currency-${c}`}
              title={c}
              value={new Intl.DisplayNames([prefs.language ?? deviceLanguage()], { type: 'currency' }).of(c)}
              right={prefs.currency === c ? <Dot /> : null}
              onPress={() => {
                setPref({ currency: c });
                setSheet(null);
              }}
              last={i === SUPPORTED_CURRENCIES.length - 1}
            />
          ))}
        </ListGroup>
      </Sheet>
    </Screen>
  );
}

function Dot() {
  const { colors } = useTheme();
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />;
}
