import type { ExpoConfig } from 'expo/config';
import dziriBackend from './config/dziri-backend.json';

const config: ExpoConfig = {
  name: 'Dziri Messenger',
  slug: 'dziri-messenger',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/dziri-ring.png',
  userInterfaceStyle: 'automatic',
  scheme: 'dziri-messenger',
  ios: { supportsTablet: true, bundleIdentifier: 'com.dziri.messenger' },
  android: {
    package: 'com.dziri.messenger',
    adaptiveIcon: { foregroundImage: './assets/dziri-ring.png', backgroundColor: '#0a0b0b' },
  },
  extra: {
    inboxUrl: process.env.EXPO_PUBLIC_INBOX_URL ?? '',
    convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL ?? dziriBackend.convexUrl,
    supportCompanyId: process.env.EXPO_PUBLIC_SUPPORT_COMPANY_ID ?? '',
  },
  plugins: [
    'expo-font',
    'expo-image',
    'expo-secure-store',
    [
      'expo-localization',
      { supportedLocales: { ios: ['en', 'fr', 'ar'], android: ['en', 'fr', 'ar'] } },
    ],
    [
      'expo-splash-screen',
      { image: './assets/dziri-ring.png', imageWidth: 160, backgroundColor: '#0a0b0b' },
    ],
  ],
};
export default config;
