import React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Image } from 'expo-image';
const sources = {
  globe: require('../../assets/icons/globe.svg'),
  logout: require('../../assets/icons/logout.svg'),
  search: require('../../assets/icons/search.svg'),
  support: require('../../assets/icons/support.svg'),
  close: require('../../assets/icons/close.svg'),
  check: require('../../assets/icons/check.svg'),
};
export type IconName = keyof typeof sources;
export function Icon({ name, color, size = 20 }: { name: IconName; color: string; size?: number }) {
  return (
    <Image
      source={sources[name]}
      tintColor={color}
      contentFit="contain"
      accessible={false}
      style={{ width: size, height: size }}
    />
  );
}
export function IconButton({
  name,
  label,
  onPress,
  color,
  busy = false,
  expanded,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color: string;
  busy?: boolean;
  expanded?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, expanded }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed || busy ? 0.55 : 1,
      })}>
      {busy ? <ActivityIndicator color={color} size="small" /> : <Icon name={name} color={color} />}
    </Pressable>
  );
}
