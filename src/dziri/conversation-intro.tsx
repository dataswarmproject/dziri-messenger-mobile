import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './typography';
import { useLocale } from './locale';
import { useColors } from './ui';

export function ConversationIntro({ image }: { image?: string | null }) {
  const { t } = useLocale(),
    colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
      {image ? (
        <Image
          source={{ uri: image }}
          contentFit="cover"
          style={{ width: 100, height: 100, borderRadius: 50 }}
        />
      ) : null}
      <Text
        style={{
          fontSize: 20,
          lineHeight: 28,
          color: colors.text,
          textAlign: 'center',
          fontWeight: '600',
        }}>
        {t.sayHello}
      </Text>
    </View>
  );
}
