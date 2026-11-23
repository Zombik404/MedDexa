/**
 * MedDexa design tokens — "Premium Minimal, Modern Healthcare Technology".
 * Every colour, radius, spacing and type size in the app comes from here.
 */
export const palette = {
  forest950: '#06201A',
  forest900: '#0A2A20',
  forest800: '#0F3D2E',
  forest700: '#14503C',
  forest600: '#1B6A50',
  forest500: '#2A8466',
  mint400: '#7FE0B5',
  mint300: '#A8EBCB',
  mint200: '#CFF3E1',
  mint100: '#E8F8F0',
  neutral0: '#FFFFFF',
  neutral25: '#FAFBFA',
  neutral50: '#F6F7F5',
  neutral100: '#EEF1EE',
  neutral200: '#E3E7E4',
  neutral300: '#CDD3CF',
  neutral500: '#8A938F',
  neutral600: '#5B6662',
  neutral800: '#2C3532',
  neutral900: '#1C2321',
  night950: '#090F0D',
  night900: '#0D1513',
  night850: '#121B18',
  night800: '#18241F',
  night700: '#22312B',
  night600: '#2E3F38',
  amber: '#B7791F',
  amberSoft: '#FBF1DF',
  red: '#B4372B',
  redSoft: '#FBE8E5',
  blue: '#2F6F9F',
  blueSoft: '#E6F0F8',
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textOnPrimary: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  skeleton: string;
  overlay: string;
  tabBar: string;
  shadow: string;
}

export const lightColors: ThemeColors = {
  background: palette.neutral50,
  surface: palette.neutral0,
  surfaceAlt: palette.neutral100,
  surfaceRaised: palette.neutral0,
  border: palette.neutral200,
  borderStrong: palette.neutral300,
  text: palette.neutral900,
  textSecondary: palette.neutral600,
  textTertiary: palette.neutral500,
  textOnPrimary: palette.neutral0,
  primary: palette.forest800,
  primaryPressed: palette.forest900,
  primarySoft: palette.mint100,
  accent: palette.forest600,
  accentSoft: palette.mint200,
  success: palette.forest600,
  successSoft: palette.mint100,
  warning: palette.amber,
  warningSoft: palette.amberSoft,
  danger: palette.red,
  dangerSoft: palette.redSoft,
  info: palette.blue,
  infoSoft: palette.blueSoft,
  skeleton: palette.neutral100,
  overlay: 'rgba(6, 32, 26, 0.45)',
  tabBar: 'rgba(255,255,255,0.96)',
  shadow: '#0A2A20',
};

export const darkColors: ThemeColors = {
  background: palette.night950,
  surface: palette.night900,
  surfaceAlt: palette.night850,
  surfaceRaised: palette.night800,
  border: palette.night700,
  borderStrong: palette.night600,
  text: '#EEF3F0',
  textSecondary: '#A3B0AA',
  textTertiary: '#738079',
  textOnPrimary: palette.forest950,
  primary: palette.mint400,
  primaryPressed: palette.mint300,
  primarySoft: '#123528',
  accent: palette.mint400,
  accentSoft: '#163F31',
  success: palette.mint400,
  successSoft: '#123528',
  warning: '#E3A94B',
  warningSoft: '#33281A',
  danger: '#F07B6E',
  dangerSoft: '#3A1E1B',
  info: '#79B4E0',
  infoSoft: '#16283A',
  skeleton: palette.night800,
  overlay: 'rgba(0,0,0,0.6)',
  tabBar: 'rgba(13,21,19,0.96)',
  shadow: '#000000',
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999 } as const;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export const typography = {
  display: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6 },
  button: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  mono: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] as const },
} as const;

export type TypographyVariant = keyof typeof typography;

export function shadow(colors: ThemeColors, level: 1 | 2 | 3 = 1) {
  const map = { 1: [2, 8, 0.05], 2: [6, 18, 0.08], 3: [12, 32, 0.14] } as const;
  const [y, blur, opacity] = map[level];
  return {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: y },
    shadowRadius: blur,
    shadowOpacity: opacity,
    elevation: level * 2,
  };
}
