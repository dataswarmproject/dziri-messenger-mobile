import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Text } from './typography';
import { useLocale } from './locale';
import { useColors } from './ui';
import { IconButton } from './icons';
export interface MessageMedia {
  uri: string;
  type: 'image' | 'video' | 'voice' | 'file' | 'sticker' | 'gif';
  mime?: string;
  duration?: number;
}
function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{ width: 240, maxWidth: '100%', height: 180, borderRadius: 16 }}
    />
  );
}
function Voice({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri),
    status = useAudioPlayerStatus(player);
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status.playing ? 'Pause' : 'Play voice message'}
      onPress={() => {
        if (status.playing) player.pause();
        else {
          if (status.didJustFinish) void player.seekTo(0);
          player.play();
        }
      }}
      style={{
        minHeight: 44,
        minWidth: 160,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 16,
        backgroundColor: colors.surface,
      }}>
      <Text style={{ color: colors.primary, fontSize: 20 }}>{status.playing ? 'Ⅱ' : '▶'}</Text>
      <Text style={{ color: colors.text, fontSize: 13 }}>
        {Math.floor(status.currentTime ?? 0)} / {Math.ceil(status.duration ?? 0)} s
      </Text>
    </Pressable>
  );
}
export function MediaPreview({ media }: { media: MessageMedia }) {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();
  const colors = useColors();
  if (media.type === 'video') return <Video uri={media.uri} />;
  if (media.type === 'voice') return <Voice uri={media.uri} />;
  if (media.type === 'file') return <Text style={{ color: colors.text }}>{t.unsupported}</Text>;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.photo}
        onPress={() => setOpen(true)}>
        <Image
          source={{ uri: media.uri }}
          contentFit="cover"
          style={{ width: 220, maxWidth: '100%', height: 160, borderRadius: 16 }}
        />
      </Pressable>
      <Modal visible={open} transparent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
          <Image
            source={{ uri: media.uri }}
            contentFit="contain"
            style={{ width: '100%', height: '80%' }}
          />
          <View style={{ position: 'absolute', top: 32, right: 16 }}>
            <IconButton name="close" label={t.close} color="#fff" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
