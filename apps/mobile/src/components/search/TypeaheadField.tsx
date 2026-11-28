import type { FilterOptionField } from '@meddexa/shared';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useFilterOptions } from '@/api/hooks';
import { useLocalize } from '@/lib/localize';
import { Chip, Text, TextField } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

interface Props {
  field: FilterOptionField;
  label: string;
  placeholder?: string;
  /** Selected values (one for single fields). */
  values: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
  keyboardType?: 'default' | 'numeric';
  testID?: string;
}

/**
 * A filter field that suggests values from the catalogue as soon as you type a letter
 * (and the most common ones before you type anything), so nothing has to be typed in full.
 */
export function TypeaheadField({ field, label, placeholder, values, onChange, multiple, keyboardType = 'default', testID }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const options = useFilterOptions(field, text, open);
  const l = useLocalize();
  const shown = (options.data ?? []).filter((o) => !values.includes(o.value)).slice(0, 6);
  /** Option and chip text in the app language (values sent to the API stay as catalogued). */
  const display = (value: string, label = value) => {
    if (field === 'ingredient') return l.ingredientName(value);
    if (field === 'strength') return l.dose(label);
    if (field === 'packageSize') {
      const m = label.match(/^([\d.]+)\s+(\S+)$/);
      return m ? l.pack(m[1]!, m[2]!) : label;
    }
    return label;
  };

  const pick = (value: string) => {
    onChange(multiple ? [...values, value] : [value]);
    setText('');
    if (!multiple) setOpen(false);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {values.length ? (
        <View style={{ gap: 6 }}>
          <Text variant="small" color="textSecondary" style={{ fontFamily: 'Manrope_600SemiBold' }}>
            {label}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {values.map((v) => (
              <Chip key={v} icon={X} label={display(v)} selected onPress={() => onChange(values.filter((x) => x !== v))} />
            ))}
          </View>
        </View>
      ) : null}
      {multiple || !values.length ? (
        <TextField
          testID={testID}
          label={values.length ? t('search.f.addMore') : label}
          placeholder={placeholder ?? t('search.f.typeToSee')}
          value={text}
          onChangeText={setText}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
        />
      ) : null}
      {open && shown.length ? (
        <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
          {shown.map((o, i) => (
            <Pressable
              key={o.value}
              testID={testID ? `${testID}-option-${i}` : undefined}
              accessibilityRole="button"
              accessibilityLabel={display(o.value, o.label)}
              onPress={() => pick(o.value)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: colors.border,
              })}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {display(o.value, o.label)}
                </Text>
                {o.secondary && (field !== 'atc' || l.lang.startsWith('en')) && (field !== 'ingredient' || o.secondary !== display(o.value)) ? (
                  <Text variant="small" color="textSecondary" numberOfLines={1}>
                    {o.secondary}
                  </Text>
                ) : null}
              </View>
              {field !== 'registration' ? (
                <Text variant="small" color="textTertiary">
                  {o.count}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : open && text && options.isSuccess && !shown.length ? (
        <Text variant="small" color="textTertiary">
          {t('search.f.noOptions')}
        </Text>
      ) : null}
    </View>
  );
}

/** Country picker: flags and names, one tap to choose. */
export function CountryList({ countries, values, onChange }: { countries: { code: string; name: string; flag: string }[]; values: string[]; onChange: (codes: string[]) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      {countries.map((c, i) => {
        const selected = values.includes(c.code);
        return (
          <Pressable
            key={c.code}
            testID={`country-${c.code}`}
            accessibilityRole="checkbox"
            accessibilityState={{ selected }}
            accessibilityLabel={c.name}
            onPress={() => onChange(selected ? values.filter((v) => v !== c.code) : [...values, c.code])}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfaceAlt : colors.surface,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: colors.border,
            })}
          >
            <Text style={{ fontSize: 22 }}>{c.flag}</Text>
            <Text variant="body" style={{ flex: 1 }}>
              {c.name}
            </Text>
            {selected ? <Check size={18} color={colors.primary} strokeWidth={2.6} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
