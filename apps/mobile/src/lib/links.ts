import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

export async function callPhone(phone: string) {
  await Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
}

export async function openWebsite(url: string) {
  await WebBrowser.openBrowserAsync(url);
}

/** Opens turn-by-turn directions in the platform's maps app. */
export async function openDirections(lat: number, lng: number, label: string) {
  const q = encodeURIComponent(label);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${q}`
      : Platform.OS === 'android'
        ? `google.navigation:q=${lat},${lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  try {
    await Linking.openURL(url);
  } catch {
    await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
  }
}
