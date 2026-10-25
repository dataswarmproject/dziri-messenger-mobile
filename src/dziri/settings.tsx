import React, { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from './typography';
import { dziriApi, type MessengerPreferences } from './api';
import type { MessengerRoutes } from './routes';
import { LanguageMenu, Notice, useColors } from './ui';
import { useLocale } from './locale';
import { useAppearance } from './appearance';
import { FigmaButton } from './figma';
export function SettingsScreen({
  navigation,
  account,
}: NativeStackScreenProps<MessengerRoutes, 'Settings'> & { account: ReactNode }) {
  const me = useQuery(dziriApi.me, {});
  const presence = useQuery(dziriApi.presence, me ? { userIds: [me._id] } : 'skip');
  const settings = presence?.find(row => row.userId === me?._id)?.settings;
  const save = useMutation(dziriApi.savePreferences);
  const { t, rtl } = useLocale();
  const colors = useColors();
  const { dark, setDark } = useAppearance();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(false);
  if (!me) return <Notice text={t.loading} busy />;
  async function change(key: keyof MessengerPreferences, value: boolean) {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      await save({ [key]: value });
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          height: 52,
          paddingHorizontal: 8,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <FigmaButton name="back" label={t.close} onPress={() => navigation.goBack()} />
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row' }}>
          <LanguageMenu />
          {account}
        </View>
      </View>
      <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 40, gap: 12 }}>
        {me.image ? (
          <Image source={{ uri: me.image }} style={{ width: 100, height: 100, borderRadius: 50 }} />
        ) : (
          <Image
            source={require('../../assets/dziri-ring.svg')}
            style={{ width: 100, height: 100 }}
          />
        )}
        <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.text }}>
          {me.name || t.you}
        </Text>
        <Text style={{ fontSize: 13, color: colors.secondary }}>{t.app}</Text>
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <View
          style={{
            minHeight: 60,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomWidth: 0.5,
            borderColor: colors.border,
          }}>
          <Text style={{ fontSize: 15, color: colors.text }}>{t.darkMode}</Text>
          <Switch
            accessibilityLabel={t.darkMode}
            value={dark}
            onValueChange={setDark}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: colors.secondary,
            paddingTop: 28,
            paddingBottom: 8,
          }}>
          {t.privacyHeading.toUpperCase()}
        </Text>
        {(['activityStatus', 'lastSeen', 'readReceipts', 'typingIndicators'] as const).map(key => (
          <View
            key={key}
            style={{
              minHeight: 60,
              flexDirection: rtl ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottomWidth: 0.5,
              borderColor: colors.border,
            }}>
            <Text style={{ fontSize: 15, color: colors.text, flex: 1 }}>{t[key]}</Text>
            <Switch
              accessibilityLabel={t[key]}
              disabled={pending || !settings}
              value={settings?.[key] ?? false}
              onValueChange={value => void change(key, value)}
              trackColor={{ true: colors.primary }}
            />
          </View>
        ))}
        {error ? (
          <Text accessibilityRole="alert" style={{ paddingVertical: 12, color: colors.text }}>
            {t.failed}
          </Text>
        ) : null}
        {(['people', 'discover'] as const).map(mode => (
          <Pressable
            key={mode}
            accessibilityRole="button"
            onPress={() => navigation.navigate('People', { mode })}
            style={{
              minHeight: 60,
              justifyContent: 'center',
              borderBottomWidth: 0.5,
              borderColor: colors.border,
            }}>
            <Text style={{ fontSize: 15, color: colors.text }}>{t[mode]}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
