import React from 'react';
import { Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useAppearance } from './appearance';
import { useLocale } from './locale';
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
} as const;
export type FigmaIconName = keyof typeof assets;
export function FigmaIcon({ name }: { name: FigmaIconName }) {
  const [source, width, height] = assets[name];
  const { dark } = useAppearance();
  const { rtl } = useLocale();
  const selectedGlyph = name === 'chats' || name === 'peopleActive' || name === 'discoverActive';
  return (
    <Image
      source={source}
      accessible={false}
      contentFit="contain"
      tintColor={dark && selectedGlyph ? '#fff' : undefined}
      style={{ width, height, transform: name === 'back' && rtl ? [{ scaleX: -1 }] : undefined }}
    />
  );
}
export function FigmaButton({
  name,
  label,
  onPress,
  disabled = false,
}: {
  name: FigmaIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: pressed || disabled ? 0.5 : 1,
      })}>
      <FigmaIcon name={name} />
    </Pressable>
  );
}
export function messengerColors(dark: boolean) {
  return {
    primary: dark ? '#19a3fe' : '#0584fe',
    background: dark ? '#000000' : '#ffffff',
    surface: dark ? '#333333' : '#f0f0f0',
    text: dark ? '#ffffff' : '#000000',
    secondary: dark ? '#a3a3a3' : '#808080',
    border: dark ? '#252525' : '#ededed',
    outgoing: dark ? '#19a3fe' : '#0584fe',
    outgoingText: '#ffffff',
  };
}
