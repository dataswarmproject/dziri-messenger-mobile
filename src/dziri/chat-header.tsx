import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './typography';
import { FigmaButton } from './figma';
import { useColors } from './ui';
import { useLocale } from './locale';
export function ChatHeader({
  name,
  image,
  back,
  details,
}: {
  name: string;
  image?: string | null;
  back: () => void;
  details: () => void;
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
          accessibilityLabel={t.details}
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
              style={{ fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.text }}>
              {name}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 13, lineHeight: 18, color: colors.secondary }}>
              {t.app}
            </Text>
          </View>
        </Pressable>
        <FigmaButton name="call" label={t.voiceCall} onPress={() => setCallInfo(value => !value)} />
        <FigmaButton
          name="video"
          label={t.videoCall}
          onPress={() => setCallInfo(value => !value)}
        />
      </View>
      {callInfo ? (
        <Text
          accessibilityRole="alert"
          style={{
            paddingHorizontal: 16,
            paddingBottom: 12,
            fontSize: 13,
            color: colors.secondary,
          }}>
          {t.callUnavailable}
        </Text>
      ) : null}
    </View>
  );
}
