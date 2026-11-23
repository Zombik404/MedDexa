/* global jest */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn() }));
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    AFTER_FIRST_UNLOCK: 0,
    getItemAsync: jest.fn(async (k) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k, v) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k) => void store.delete(k)),
  };
});
jest.mock('expo-router', () => {
  const push = jest.fn();
  return { useRouter: () => ({ push, back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}), Link: 'Link', __push: push };
});
// Minimal Reanimated stand-in: the app only uses a few primitives and layout animations.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const anim = { duration: () => anim, delay: () => anim };
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => fn(),
    withTiming: (v) => v,
    withRepeat: (v) => v,
    Easing: { inOut: () => (t) => t, quad: (t) => t },
    FadeIn: anim,
    FadeInDown: anim,
    FadeOutDown: anim,
  };
});
