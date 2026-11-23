import type { PharmacySummary } from '@meddexa/shared';
import { Map as MapIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/**
 * Web preview fallback: react-native-maps has no web renderer. Plots pharmacies on a
 * simple projected canvas so the layout can be reviewed in a browser.
 */
export default function PharmacyMap({ pharmacies, selectedId, onSelect }: { pharmacies: PharmacySummary[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lats = pharmacies.map((p) => p.lat);
  const lngs = pharmacies.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const spanLat = Math.max(maxLat - minLat, 0.01);
  const spanLng = Math.max(maxLng - minLng, 0.01);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      {[0.25, 0.5, 0.75].map((f) => (
        <View key={`h${f}`} style={{ position: 'absolute', left: 0, right: 0, top: `${f * 100}%`, height: 1, backgroundColor: colors.border }} />
      ))}
      {[0.25, 0.5, 0.75].map((f) => (
        <View key={`v${f}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${f * 100}%`, width: 1, backgroundColor: colors.border }} />
      ))}
      {pharmacies.map((p) => {
        const selected = p.id === selectedId;
        return (
          <View
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={p.name}
            onTouchEnd={() => onSelect(p.id)}
            style={{
              position: 'absolute',
              left: `${8 + ((p.lng - minLng) / spanLng) * 84}%`,
              top: `${8 + ((maxLat - p.lat) / spanLat) * 84}%`,
              width: selected ? 26 : 18,
              height: selected ? 26 : 18,
              borderRadius: 13,
              backgroundColor: selected ? colors.accent : colors.primary,
              borderWidth: 3,
              borderColor: '#FFFFFF',
            }}
          />
        );
      })}
      <View style={{ position: 'absolute', left: spacing.md, top: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 }}>
        <MapIcon size={14} color={colors.textSecondary} />
        <Text variant="small" color="textSecondary">
          {t('pharmacies.mapWeb')}
        </Text>
      </View>
    </View>
  );
}
