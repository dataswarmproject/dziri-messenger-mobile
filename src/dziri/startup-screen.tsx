import React from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useLocale } from './locale';
import { useColors } from './ui';
export function StartupScreen() {
  const colors = useColors(),
    { t } = useLocale();
  return (
    <View
      accessibilityLabel={t.loading}
      accessibilityState={{ busy: true }}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        padding: 24,
      }}>
      <Image
        source={require('../../assets/dziri-ring.png')}
        contentFit="contain"
        accessible={false}
        style={{ width: 112, height: 112, borderRadius: 24 }}
      />
      <Text
        style={{
          color: colors.text,
          fontSize: 18,
          lineHeight: 24,
          fontWeight: '600',
          textAlign: 'center',
          marginTop: 16,
        }}>
        {t.app}
      </Text>
      <ActivityIndicator
        accessibilityLabel={t.loading}
        size="small"
        color={colors.secondary}
        style={{ marginTop: 24 }}
      />
    </View>
  );
}
