import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { Text } from './Text';

/** Original MedDexa mark: two pillars joined by a valley — an "M" that reads as a side-by-side comparison. */
export function LogoMark({ size = 40, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="MedDexa">
      <Rect width="1024" height="1024" rx="232" fill={inverted ? '#FFFFFF' : palette.forest800} />
      <Path d="M300 716 V330 L512 560 L724 330 V716" fill="none" stroke={inverted ? palette.forest800 : '#FFFFFF'} strokeWidth={116} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="512" cy="258" r="62" fill={palette.mint400} />
    </Svg>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.4 }}>
      <LogoMark size={size * 1.45} />
      <Text style={{ fontFamily: 'Manrope_800ExtraBold', fontSize: size, letterSpacing: -0.6, color: colors.text }}>
        Med<Text style={{ fontFamily: 'Manrope_800ExtraBold', fontSize: size, letterSpacing: -0.6, color: colors.accent }}>Dexa</Text>
      </Text>
    </View>
  );
}
