import type { ExpoConfig } from 'expo/config';
import dziriBackend from './config/dziri-backend.json';

const config: ExpoConfig = {
  name: 'DM',
  slug: 'dziri-messenger',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/dziri-ring.png',
  userInterfaceStyle: 'automatic',
  scheme: 'dziri-messenger',
  web: { name: 'Dziri Messenger', shortName: 'DM' },
  ios: { supportsTablet: true, bundleIdentifier: 'com.dziri.messenger' },
  android: {
    package: 'com.dziri.messenger',
    adaptiveIcon: { foregroundImage: './assets/dziri-ring.png', backgroundColor: '#000000' },
  },
  extra: {
    inboxUrl: process.env.EXPO_PUBLIC_INBOX_URL ?? '',
    convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL ?? dziriBackend.convexUrl,
    supportCompanyId: process.env.EXPO_PUBLIC_SUPPORT_COMPANY_ID ?? '',
  },
  plugins: [
    './plugins/with-launcher-icon.cjs',
    'expo-font',
    'expo-image',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow Dziri Messenger to take photos you choose to send.',
        microphonePermission: 'Allow Dziri Messenger to record a voice message.',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow Dziri Messenger to select photos you choose to send.',
        cameraPermission: 'Allow Dziri Messenger to take a photo.',
        microphonePermission: 'Allow Dziri Messenger to record a voice message.',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Allow Dziri Messenger to record a voice message.',
        enableBackgroundRecording: false,
      },
    ],
    'expo-video',
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
