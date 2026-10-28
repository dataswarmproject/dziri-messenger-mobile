import React from 'react';
import { Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useAppearance } from './appearance';
import { useLocale } from './locale';
import { messengerColors } from './colors';
export { messengerColors } from './colors';
// Natural SVG dimensions are retained from the exported Figma layers.
const assets = {
  search: [require('../../assets/figma/search.svg'), 15.5012, 15.7012],
  newMessage: [require('../../assets/figma/new-message.svg'), 40, 40],
  cameraTop: [require('../../assets/figma/camera-top.svg'), 40, 40],
  discover: [require('../../assets/figma/discover.svg'), 24, 24],
  people: [require('../../assets/figma/people.svg'), 29.9553, 22.08],
  peopleActive: [require('../../assets/figma/people-active.svg'), 29.9553, 22.08],
  chats: [require('../../assets/figma/chats.svg'), 24, 24.037],
  chatsInactive: [require('../../assets/figma/chats-inactive.svg'), 24, 24.037],
  discoverActive: [require('../../assets/figma/discover-active.svg'), 24, 24],
  discoverDark: [require('../../assets/figma/discover-dark.svg'), 24, 24],
  back: [require('../../assets/figma/back.svg'), 12.6224, 22.2447],
  emoji: [require('../../assets/figma/emoji.svg'), 24, 24],
  like: [require('../../assets/figma/like.svg'), 24, 25],
  call: [require('../../assets/figma/call.svg'), 23, 23],
  video: [require('../../assets/figma/video.svg'), 27, 18],
  actions: [require('../../assets/figma/actions.svg'), 20, 20],
  photo: [require('../../assets/figma/photo.svg'), 25, 22],
  gallery: [require('../../assets/figma/gallery.svg'), 22, 22],
  audio: [require('../../assets/figma/audio.svg'), 18, 24],
  profileAudio: [require('../../assets/figma/profile-audio.svg'), 40, 40],
  profileVideo: [require('../../assets/figma/profile-video.svg'), 40, 40],
  profileUser: [require('../../assets/figma/profile-user.svg'), 40, 40],
  profileMute: [require('../../assets/figma/profile-mute.svg'), 40, 40],
  cameraClose: [require('../../assets/figma/camera-close.svg'), 18.5, 19],
  cameraFlash: [require('../../assets/figma/camera-flash.svg'), 25, 29.328],
  cameraGallery: [require('../../assets/figma/camera-gallery.svg'), 22, 22],
  shutter: [require('../../assets/figma/shutter.svg'), 76, 76],
  switchCamera: [require('../../assets/figma/switch-camera.svg'), 23, 20],
  pickerClose: [require('../../assets/figma/picker-close.svg'), 17.1421, 17.1421],
  pickerSearch: [require('../../assets/figma/picker-search.svg'), 12.5786, 12.5786],
  swipeCircle: [require('../../assets/figma/swipe-circle.svg'), 40, 40],
  swipeMenu: [require('../../assets/figma/swipe-menu.svg'), 18, 13.8],
  swipeMute: [require('../../assets/figma/swipe-mute.svg'), 17, 19.25],
  settingsMoon: [require('../../assets/figma/settings-moon.svg'), 40, 40],
  settingsActive: [require('../../assets/figma/settings-active.svg'), 40, 40],
  settingsUsername: [require('../../assets/figma/settings-username.svg'), 40, 40],
  settingsPhone: [require('../../assets/figma/settings-phone.svg'), 40, 40],
  settingsPeople: [require('../../assets/figma/settings-people.svg'), 40, 40],
  settingsMessaging: [require('../../assets/figma/settings-messaging.svg'), 40, 40],
  chevron: [require('../../assets/figma/chevron.svg'), 7.82742, 12.8264],
  peopleRequests: [require('../../assets/figma/people-requests.svg'), 40, 40],
  peopleAdd: [require('../../assets/figma/people-add.svg'), 40, 40],
  peopleWave: [require('../../assets/figma/people-wave.svg'), 32, 32],
  group: [require('../../assets/figma/group.svg'), 40, 40],
} as const;
export type FigmaIconName = keyof typeof assets;
export function FigmaIcon({ name }: { name: FigmaIconName }) {
  const [source, width, height] = assets[name];
  const { dark } = useAppearance();
  const { rtl } = useLocale();
  const selectedGlyph = [
    'chats',
    'peopleActive',
    'discoverActive',
    'peopleRequests',
    'peopleAdd',
    'peopleWave',
    'group',
    'chevron',
    'profileAudio',
    'profileVideo',
    'profileUser',
    'profileMute',
  ].includes(name);
  const accentGlyph = ['back', 'call', 'video', 'actions', 'emoji', 'like', 'pickerClose'].includes(
    name,
  );
  return (
    <Image
      source={source}
      accessible={false}
      contentFit="contain"
      tintColor={
        dark && name === 'swipeCircle'
          ? '#333333'
          : dark && (name === 'swipeMenu' || name === 'swipeMute')
            ? '#fff'
            : accentGlyph
              ? messengerColors(dark).primary
              : dark && selectedGlyph
                ? '#fff'
                : undefined
      }
      style={{
        width,
        height,
        transform: (name === 'back' || name === 'chevron') && rtl ? [{ scaleX: -1 }] : undefined,
      }}
    />
  );
}
export function FigmaButton({
  name,
  label,
  onPress,
  disabled = false,
  compact = false,
}: {
  name: FigmaIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      hitSlop={compact ? 6 : undefined}
      style={({ pressed }) => ({
        width: compact ? 32 : 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: pressed || disabled ? 0.5 : 1,
      })}>
      <FigmaIcon name={name} />
    </Pressable>
  );
}
