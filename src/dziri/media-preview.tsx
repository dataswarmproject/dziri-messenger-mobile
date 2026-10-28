import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { VoiceMessage } from './voice-message';
import { claimPlayback } from './playback-coordinator';
import { useObservedPlayback } from './use-observed-playback';
import { Text } from './typography';
import { useLocale } from './locale';
import { useColors } from './ui';
import { Icon, IconButton } from './icons';
import { safeMediaUrl, mediaBytes } from './message-media.generated';
export interface MessageMedia {
  uri: string;
  type: 'image' | 'video' | 'voice' | 'file' | 'sticker' | 'gif';
  mime?: string;
  duration?: number;
  name?: string;
  size?: number;
}
function Document({ media, outgoing }: { media: MessageMedia; outgoing: boolean }) {
  const [failed, setFailed] = useState(false);
  const { t, rtl } = useLocale(),
    colors = useColors();
  const color = outgoing ? colors.outgoingText : colors.text;
  const canOpen = safeMediaUrl(media.uri);
  return (
    <View style={{ maxWidth: '100%' }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t.openFile}
        disabled={!canOpen}
        onPress={event => {
          event.stopPropagation();
          setFailed(false);
          void Linking.openURL(media.uri).catch(() => setFailed(true));
        }}
        style={{
          minHeight: 52,
          maxWidth: 240,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 10,
          padding: 8,
        }}>
        <Icon name="file" color={color} size={24} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ color, fontSize: 14 }}>
            {media.name || t.file}
          </Text>
          <Text numberOfLines={1} style={{ color, fontSize: 11, opacity: 0.7 }}>
            {[media.mime, mediaBytes(media.size)].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>
      {failed ? (
        <Text accessibilityRole="alert" style={{ color, fontSize: 12 }}>
          {t.openFileFailed}
        </Text>
      ) : null}
    </View>
  );
}
interface PlaybackObserver {
  onPlayingChange?: (playing: boolean) => void;
  onProgress?: (progress: number) => void;
  onEnded?: () => void;
  paused?: boolean;
  autoPlay?: boolean;
  playRequest?: number;
  onError?: () => void;
}
function Video({
  uri,
  onPlayingChange,
  onProgress,
  onEnded,
  paused,
  autoPlay,
  playRequest,
  onError,
  fullScreen,
}: { uri: string; fullScreen?: boolean } & PlaybackObserver) {
  const player = useVideoPlayer(uri, video => {
    if (onProgress) video.timeUpdateEventInterval = 0.25;
  });
  useEffect(() => {
    const playing = player.addListener('playingChange', event => {
      if (event.isPlaying) claimPlayback(player);
      onPlayingChange?.(event.isPlaying);
    });
    const progress = player.addListener('timeUpdate', event => {
      if (player.duration > 0) onProgress?.(event.currentTime / player.duration);
    });
    const ended = player.addListener('playToEnd', () => onEnded?.());
    const status = player.addListener('statusChange', event => {
      if (event.status === 'error') onError?.();
    });
    return () => {
      playing.remove();
      progress.remove();
      ended.remove();
      status.remove();
    };
  }, [player, onPlayingChange, onProgress, onEnded, onError]);
  useObservedPlayback(player, { paused, autoPlay, playRequest, playing: player.playing, onError });

  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{
        width: fullScreen ? '100%' : 240,
        maxWidth: '100%',
        height: fullScreen ? '100%' : 180,
        borderRadius: fullScreen ? 0 : 16,
      }}
    />
  );
}
export function MediaPreview({
  media,
  thumbnailSize,
  outgoing = false,
  fullScreen,
  ...playback
}: {
  media: MessageMedia;
  thumbnailSize?: number;
  outgoing?: boolean;
  fullScreen?: boolean;
} & PlaybackObserver) {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();
  if (media.type === 'video')
    return <Video uri={media.uri} fullScreen={fullScreen} {...playback} />;
  if (media.type === 'voice')
    return (
      <VoiceMessage uri={media.uri} durationMs={media.duration} outgoing={outgoing} {...playback} />
    );
  if (media.type === 'file') return <Document key={media.uri} media={media} outgoing={outgoing} />;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.photo}
        onPress={() => setOpen(true)}>
        <Image
          source={{ uri: media.uri }}
          contentFit={media.type === 'sticker' ? 'contain' : 'cover'}
          style={{
            width: thumbnailSize ?? 220,
            maxWidth: '100%',
            height: thumbnailSize ?? 160,
            borderRadius: 16,
          }}
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
