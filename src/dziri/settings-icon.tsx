import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from './ui';

const assets = {
  notifications: require('../../assets/settings/bell.svg'),
  moon: require('../../assets/settings/moon.svg'),
  active: require('../../assets/settings/circle-dot.svg'),
  profile: require('../../assets/settings/user-round.svg'),
  privacy: require('../../assets/settings/shield-check.svg'),
  people: require('../../assets/settings/users-round.svg'),
  discover: require('../../assets/settings/compass.svg'),
  logout: require('../../assets/settings/log-out.svg'),
  username: require('../../assets/settings/at-sign.svg'),
  phone: require('../../assets/settings/phone.svg'),
  lastSeen: require('../../assets/settings/clock.svg'),
  readReceipts: require('../../assets/settings/check-check.svg'),
  typing: require('../../assets/settings/keyboard.svg'),
} as const;

export type SettingsIconName = keyof typeof assets;

export function SettingsIcon({ name, busy = false }: { name: SettingsIconName; busy?: boolean }) {
  const colors = useColors();
  return (
    <View
      accessible={false}
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {busy ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <Image
          source={assets[name]}
          accessible={false}
          contentFit="contain"
          tintColor={colors.text}
          style={{ width: 20, height: 20 }}
        />
      )}
    </View>
  );
}
