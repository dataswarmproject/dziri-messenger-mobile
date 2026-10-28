import React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useLocale } from './locale';
const sources = {
  file: require('../../assets/icons/file.svg'),
  link: require('../../assets/icons/link.svg'),
  play: require('../../assets/icons/play.svg'),
  pause: require('../../assets/icons/pause.svg'),
  pin: require('../../assets/icons/pin.svg'),
  menu: require('../../assets/icons/menu.svg'),
  addCircle: require('../../assets/icons/add-circle.svg'),
  more: require('../../assets/icons/more.svg'),
  copy: require('../../assets/icons/copy.svg'),
  edit: require('../../assets/icons/edit.svg'),
  trash: require('../../assets/icons/trash.svg'),
  eye: require('../../assets/icons/eye.svg'),
  eyeOff: require('../../assets/icons/eye-off.svg'),
  globe: require('../../assets/icons/globe.svg'),
  logout: require('../../assets/icons/logout.svg'),
  search: require('../../assets/icons/search.svg'),
  support: require('../../assets/icons/support.svg'),
  close: require('../../assets/icons/close.svg'),
  check: require('../../assets/icons/check.svg'),
  doubleCheck: require('../../assets/icons/double-check.svg'),
  info: require('../../assets/icons/info.svg'),
  reply: require('../../assets/icons/reply.svg'),
  smile: require('../../assets/icons/smile.svg'),
  send: require('../../assets/icons/send.svg'),
};
export type IconName = keyof typeof sources;
export function Icon({ name, color, size = 20 }: { name: IconName; color: string; size?: number }) {
  const { rtl } = useLocale();
  return (
    <Image
      source={sources[name]}
      tintColor={color}
      contentFit="contain"
      accessible={false}
      style={{
        width: size,
        height: size,
        transform: rtl && (name === 'send' || name === 'reply') ? [{ scaleX: -1 }] : undefined,
      }}
    />
  );
}
export function IconButton({
  name,
  label,
  onPress,
  color,
  busy = false,
  disabled = false,
  expanded,
  compact = false,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color: string;
  busy?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy || disabled, expanded }}
      disabled={busy || disabled}
      onPress={onPress}
      hitSlop={compact ? 6 : undefined}
      style={({ pressed }) => ({
        width: compact ? 32 : 44,
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
