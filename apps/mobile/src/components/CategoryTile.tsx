import { Citrus, Droplet, Eye, Flower2, HeartPulse, Moon, Pill, ShieldPlus, Soup, Sparkles, Thermometer, Venus, Zap, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const ICONS: Record<string, LucideIcon> = {
  pain: Zap,
  cold: Thermometer,
  allergy: Flower2,
  digestion: Soup,
  skin: Sparkles,
  vitamins: Citrus,
  heart: HeartPulse,
  sleep: Moon,
  eyes: Eye,
  antibiotics: ShieldPlus,
  diabetes: Droplet,
  women: Venus,
};

/** Category icon in its tinted circle (static elements keep React from remounting icons). */
export function CategoryIcon({ icon, size = 42 }: { icon: string; size?: number }) {
  const { colors } = useTheme();
  const p = { size: Math.round(size / 2), color: colors.primary, strokeWidth: 2 };
  const Icon = ICONS[icon] ?? Pill;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      {Icon === Zap ? <Zap {...p} /> : Icon === Thermometer ? <Thermometer {...p} /> : Icon === Flower2 ? <Flower2 {...p} /> : Icon === Soup ? <Soup {...p} /> : Icon === Sparkles ? <Sparkles {...p} /> : Icon === Citrus ? <Citrus {...p} /> : Icon === HeartPulse ? <HeartPulse {...p} /> : Icon === Moon ? <Moon {...p} /> : Icon === Eye ? <Eye {...p} /> : Icon === ShieldPlus ? <ShieldPlus {...p} /> : Icon === Droplet ? <Droplet {...p} /> : Icon === Venus ? <Venus {...p} /> : <Pill {...p} />}
    </View>
  );
}

export function CategoryTile({ slug, icon, onPress, width }: { slug: string; icon: string; onPress: () => void; width?: number }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const Icon = ICONS[icon] ?? Pill;
  const label = t(`category.${slug}`);
  return (
    <Pressable
      testID={`category-${slug}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: width ?? '31%',
        minHeight: 96,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={21} color={colors.primary} strokeWidth={2} />
      </View>
      <Text variant="small" align="center" numberOfLines={2} style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 12.5, lineHeight: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}
