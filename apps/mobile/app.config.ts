import type { ExpoConfig } from 'expo/config';

/**
 * Native configuration (Continuous Native Generation — ios/ and android/ are generated).
 * Secrets come from EAS environment variables, never from source.
 */
const config: ExpoConfig = {
  name: 'MedDexa',
  slug: 'meddexa',
  scheme: 'meddexa',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#F6F7F5',
  ios: {
    bundleIdentifier: 'app.meddexa',
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'app.meddexa',
    adaptiveIcon: {
      backgroundColor: '#0F3D2E',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single' },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 140,
        backgroundColor: '#0F3D2E',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#0A2A20' },
      },
    ],
    'expo-font',
    'expo-image',
    'expo-web-browser',
    [
      'expo-camera',
      {
        cameraPermission: 'MedDexa uses the camera only to read the barcode or the text on a medicine box. Photos are not stored.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'MedDexa reads the text on a photo of a medicine box you choose, to find that medicine. Photos are not stored.',
        cameraPermission: 'MedDexa uses the camera only to read the barcode or the text on a medicine box. Photos are not stored.',
        microphonePermission: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'MedDexa uses your location only while the app is open, to show pharmacies near you. It is never stored on our servers.',
      },
    ],
    [
      'react-native-maps',
      {
        // Android always renders Google Maps; iOS uses Apple Maps unless a key is set.
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY,
      },
    ],
    ['expo-notifications', { color: '#0F3D2E' }],
    [
      '@sentry/react-native',
      { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
