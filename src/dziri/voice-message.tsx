import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { claimPlayback } from './playback-coordinator';
import { useObservedPlayback } from './use-observed-playback';
import { Text } from './typography';
import { Icon } from './icons';
import { useLocale } from './locale';
import { useColors } from './ui';
import {
  audioClock,
  audioProgress,
  voicePlayerMetrics as metrics,
} from './message-presentation.generated';

export function VoiceMessage({
  uri,
  durationMs,
  outgoing = false,
  paused,
  onPlayingChange,
  onProgress,
  onEnded,
  onError,
  autoPlay,
  playRequest,
}: {
  uri: string;
  durationMs?: number;
  outgoing?: boolean;
  paused?: boolean;
  onPlayingChange?: (value: boolean) => void;
  onProgress?: (value: number) => void;
  onEnded?: () => void;
  onError?: () => void;
  autoPlay?: boolean;
  playRequest?: number;
}) {
  const player = useAudioPlayer(uri),
    status = useAudioPlayerStatus(player);
  const colors = useColors(),
    { t } = useLocale();
  const [failed, setFailed] = useState(false),
    [trackWidth, setTrackWidth] = useState(1);
  const duration =
    status.duration > 0 && Number.isFinite(status.duration)
      ? status.duration
      : Math.max(0, (durationMs ?? 0) / 1000);
  const time = Number.isFinite(status.currentTime) ? Math.max(0, status.currentTime) : 0;
  const foreground = outgoing ? colors.outgoingText : colors.text;
  useEffect(() => {
    if (status.playing) claimPlayback(player);
    onPlayingChange?.(status.playing);
  }, [status.playing, onPlayingChange, player]);
  useEffect(() => {
    onProgress?.(audioProgress(time, duration));
  }, [time, duration, onProgress]);
  useEffect(() => {
    if (status.didJustFinish) onEnded?.();
  }, [status.didJustFinish, onEnded]);
  useObservedPlayback(player, { paused, autoPlay, playRequest, playing: status.playing, onError });
  useEffect(() => {
    if (status.playbackState === 'error') onError?.();
  }, [status.playbackState, onError]);
  async function seek(seconds: number) {
    if (!duration || !status.isLoaded) return;
    try {
      await player.seekTo(Math.max(0, Math.min(duration, seconds)));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  async function toggle() {
    setFailed(false);
    try {
      if (status.playing) player.pause();
      else {
        claimPlayback(player);
        if (status.didJustFinish) await player.seekTo(0);
        player.play();
      }
    } catch {
      setFailed(true);
      onError?.();
    }
  }
  return (
    <View
      style={{
        width: metrics.width,
        maxWidth: '100%',
        minHeight: metrics.minHeight,
        borderRadius: 24,
        backgroundColor: outgoing ? colors.outgoing : colors.surface,
        padding: metrics.padding,
        direction: 'ltr',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: metrics.gap }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={status.playing ? t.pauseVoice : t.playVoice}
          onPress={event => {
            event.stopPropagation();
            void toggle();
          }}
          style={{
            width: metrics.control,
            height: metrics.control,
            borderRadius: metrics.control / 2,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', inset: 0, backgroundColor: foreground, opacity: 0.12 }}
          />
          <Icon
            name={status.playing ? 'pause' : 'playSolid'}
            size={metrics.icon}
            color={foreground}
          />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel={t.voicePosition}
            aria-valuemin={0}
            aria-valuemax={duration || 1}
            aria-valuenow={time}
            aria-valuetext={`${audioClock(time)} / ${audioClock(Math.ceil(duration))}`}
            accessibilityValue={{
              min: 0,
              max: duration || 1,
              now: time,
              text: `${audioClock(time)} / ${audioClock(Math.ceil(duration))}`,
            }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={event =>
              void seek(time + (event.nativeEvent.actionName === 'increment' ? 5 : -5))
            }
            disabled={!duration || !status.isLoaded}
            onLayout={event => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
            onPress={event => {
              event.stopPropagation();
              void seek((duration * event.nativeEvent.locationX) / trackWidth);
            }}
            {...(Platform.OS === 'web'
              ? {
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
                      event.preventDefault();
                      event.stopPropagation();
                      void seek(
                        event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? duration
                            : time + (event.key === 'ArrowRight' ? 5 : -5),
                      );
                    }
                  },
                }
              : {})}
            hitSlop={{ top: 8, bottom: 8 }}
            style={{
              height: 28,
              justifyContent: 'center',
              opacity: !duration || !status.isLoaded ? 0.5 : 1,
            }}>
            <View
              accessible={false}
              pointerEvents="none"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              {Array.from({ length: metrics.segments }, (_, index) => (
                <View
                  key={index}
                  style={{
                    width: metrics.segmentWidth,
                    height: metrics.segmentHeight,
                    borderRadius: metrics.segmentWidth,
                    backgroundColor: foreground,
                    opacity:
                      audioProgress(time, duration) >= (index + 1) / metrics.segments ? 1 : 0.45,
                  }}
                />
              ))}
            </View>
          </Pressable>
          <View
            accessible={false}
            style={{ flexDirection: 'row', justifyContent: 'space-between', opacity: 0.7 }}>
            <Text
              style={{
                fontSize: metrics.timeSize,
                lineHeight: metrics.timeLine,
                color: foreground,
                writingDirection: 'ltr',
                fontVariant: ['tabular-nums'],
              }}>
              {audioClock(time)}
            </Text>
            <Text
              style={{
                fontSize: metrics.timeSize,
                lineHeight: metrics.timeLine,
                color: foreground,
                writingDirection: 'ltr',
                fontVariant: ['tabular-nums'],
              }}>
              {audioClock(Math.ceil(duration))}
            </Text>
          </View>
        </View>
      </View>
      {failed || status.playbackState === 'error' ? (
        <Text accessibilityRole="alert" style={{ padding: 6, color: foreground, fontSize: 11 }}>
          {t.playbackFailed}
        </Text>
      ) : null}
    </View>
  );
}
