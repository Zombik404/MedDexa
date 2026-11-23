import type { MedicineSummary } from '@meddexa/shared';
import { Image } from 'expo-image';
import { Bandage, Droplet, Droplets, Milk, Pill, SprayCan, Syringe, Tablets, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type ImageSource = Pick<MedicineSummary, 'name' | 'imageUrl' | 'imageCredit' | 'form'>;

/** Illustration used when no official photo exists, chosen by dosage form. */
export function formIcon(formCode: string | null | undefined): LucideIcon {
  const f = formCode ?? '';
  if (/CAPSULE/.test(f)) return Pill;
  if (/TABLET/.test(f)) return Tablets;
  if (/SYRUP|ORAL_SOLUTION|ORAL_SUSPENSION|GRANULES/.test(f)) return Milk;
  if (/EYE_DROPS|DROPS/.test(f)) return Droplets;
  if (/SPRAY/.test(f)) return SprayCan;
  if (/INJECTION/.test(f)) return Syringe;
  if (/PATCH/.test(f)) return Bandage;
  if (/GEL|CREAM|OINTMENT/.test(f)) return Droplet;
  return Pill;
}

/** Renders the dosage-form illustration (static elements keep React from remounting icons). */
function FormIllustration({ formCode, size, color }: { formCode: string | null | undefined; size: number; color: string }) {
  const p = { size, color, strokeWidth: 1.5 };
  const Icon = formIcon(formCode);
  switch (Icon) {
    case Tablets:
      return <Tablets {...p} />;
    case Milk:
      return <Milk {...p} />;
    case Droplets:
      return <Droplets {...p} />;
    case SprayCan:
      return <SprayCan {...p} />;
    case Syringe:
      return <Syringe {...p} />;
    case Bandage:
      return <Bandage {...p} />;
    case Droplet:
      return <Droplet {...p} />;
    default:
      return <Pill {...p} />;
  }
}

/**
 * Product picture: the official packaging photo when a registry publishes one (with its
 * required credit), otherwise a calm illustration of the dosage form — never a stock photo
 * that could be mistaken for the real box.
 */
export function MedicineImage({ medicine, size = 'thumb', testID }: { medicine: ImageSource; size?: 'thumb' | 'card' | 'hero'; testID?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const dims = size === 'hero' ? { width: '100%' as const, height: 220 } : size === 'card' ? { width: 72, height: 72 } : { width: 56, height: 56 };
  const round = size === 'hero' ? radius.xxl : radius.lg;
  const photo = medicine.imageUrl && !failed ? medicine.imageUrl : null;

  return (
    <View testID={testID}>
      <View
        style={{
          ...dims,
          borderRadius: round,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: photo ? '#FFFFFF' : colors.primarySoft,
          borderWidth: photo ? 1 : 0,
          borderColor: colors.border,
        }}
      >
        {photo ? (
          <Image
            source={photo}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            transition={150}
            accessibilityLabel={t('medicine.photoOf', { name: medicine.name })}
            onError={() => setFailed(true)}
          />
        ) : (
          <View accessible accessibilityLabel={t('medicine.noPhoto')} style={{ alignItems: 'center', gap: spacing.sm }}>
            <FormIllustration formCode={medicine.form?.code} size={size === 'hero' ? 72 : size === 'card' ? 32 : 26} color={colors.primary} />
            {size === 'hero' && medicine.form ? (
              <Text variant="small" color="textSecondary">
                {medicine.form.name}
              </Text>
            ) : null}
          </View>
        )}
      </View>
      {size === 'hero' ? (
        <Text variant="caption" color="textTertiary" style={{ marginTop: 6, textAlign: 'right' }}>
          {photo ? t('medicine.photoCredit', { source: medicine.imageCredit ?? '—' }) : t('medicine.noPhotoNote')}
        </Text>
      ) : null}
    </View>
  );
}
