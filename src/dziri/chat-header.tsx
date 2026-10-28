import { messengerMetrics as metrics } from './colors';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './typography';
import { FigmaButton } from './figma';
import { IconButton } from './icons';
import { useColors } from './ui';
import { useLocale } from './locale';
export function ChatHeader({
  name,
  image,
  back,
  details,
  subtitle,
}: {
  name: string;
  image?: string | null;
  back: () => void;
  details: () => void;
  subtitle?: string;
}) {
  const colors = useColors();
  const { t, rtl } = useLocale();
  const [callInfo, setCallInfo] = useState(false);
  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderBottomWidth: 0.5,
        borderColor: colors.border,
      }}>
      <View
        style={{
          height: 56,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 4,
        }}>
        <FigmaButton name="back" label={t.back} onPress={back} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.details}: ${name}`}
          onPress={details}
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 10,
          }}>
          {image ? (
            <Image source={{ uri: image }} style={{ width: 36, height: 36, borderRadius: 18 }} />
          ) : (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: colors.secondary }}>{name[0]}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: metrics.message,
                lineHeight: metrics.messageLine,
                fontWeight: '700',
                color: colors.text,
              }}>
              {name}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: metrics.preview,
                lineHeight: metrics.previewLine,
                color: colors.secondary,
              }}>
              {subtitle || t.app}
            </Text>
          </View>
        </Pressable>
        <FigmaButton
          compact
          name="call"
          label={t.voiceCall}
          onPress={() => setCallInfo(value => !value)}
        />
        <FigmaButton
          name="video"
          compact
          label={t.videoCall}
          onPress={() => setCallInfo(value => !value)}
        />
        <IconButton
          compact
          name="info"
          label={t.details}
          color={colors.primary}
          onPress={details}
        />
      </View>
      {callInfo ? (
        <Text
          accessibilityRole="alert"
          style={{
            paddingHorizontal: 16,
            paddingBottom: 12,
            fontSize: metrics.preview,
            color: colors.secondary,
          }}>
          {t.callUnavailable}
        </Text>
      ) : null}
    </View>
  );
}
