import { messengerMetrics as metrics } from './colors';
import React, { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from './typography';
import { dziriApi, type MessengerPreferences } from './api';
import type { MessengerRoutes } from './routes';
import { LanguageMenu, Notice, useColors } from './ui';
import { useLocale } from './locale';
import { useAppearance } from './appearance';
import { FigmaButton, FigmaIcon } from './figma';
import { SettingsIcon, type SettingsIconName } from './settings-icon';
import { ScreenHeading } from './screen-parts';
import { MessengerSwitch } from './switch';

const preferenceIcons: Record<keyof MessengerPreferences, SettingsIconName> = {
  activityStatus: 'active',
  lastSeen: 'lastSeen',
  readReceipts: 'readReceipts',
  typingIndicators: 'typing',
};

function SettingsRow({
  icon,
  title,
  value,
  onPress,
  children,
}: {
  icon: SettingsIconName;
  title: string;
  value?: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const { rtl } = useLocale();
  const colors = useColors();
  const content = (
    <>
      <SettingsIcon name={icon} />
      <View
        style={{
          minHeight: 60,
          flex: 1,
          minWidth: 0,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 10,
          borderBottomWidth: 0.5,
          borderColor: colors.border,
        }}>
        <Text
          style={{
            flex: 1,
            fontSize: metrics.message,
            lineHeight: metrics.messageLine,
            color: colors.text,
          }}>
          {title}
        </Text>
        {value ? (
          <Text
            numberOfLines={1}
            style={{
              maxWidth: '45%',
              fontSize: metrics.preview,
              lineHeight: metrics.previewLine,
              color: colors.secondary,
            }}>
            {value}
          </Text>
        ) : null}
        {children}
        {onPress ? <FigmaIcon name="chevron" /> : null}
      </View>
    </>
  );
  const style = {
    minHeight: 60,
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: rtl ? ('row-reverse' as const) : ('row' as const),
    alignItems: 'center' as const,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={style}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

export function SettingsScreen({
  navigation,
  account,
}: NativeStackScreenProps<MessengerRoutes, 'Settings'> & { account: ReactNode }) {
  const me = useQuery(dziriApi.me, {});
  const presence = useQuery(dziriApi.presence, me ? { userIds: [me._id] } : 'skip');
  const settings = presence?.find(row => row.userId === me?._id)?.settings;
  const { t, rtl } = useLocale();
  const colors = useColors();
  const { dark, setDark } = useAppearance();
  if (!me) return <Notice text={t.loading} busy />;
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}>
      <View
        style={{
          height: 52,
          paddingHorizontal: 8,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <FigmaButton name="back" label={t.back} onPress={() => navigation.goBack()} />
      </View>
      <View
        style={{
          minHeight: 278,
          alignItems: 'center',
          paddingTop: 34,
          paddingBottom: 44,
          gap: 28,
        }}>
        <Image
          source={me.image ? { uri: me.image } : require('../../assets/dziri-ring.svg')}
          contentFit="contain"
          style={{ width: 115, height: 115, borderRadius: me.image ? 58 : 0 }}
        />
        <Text
          accessibilityRole="header"
          style={{
            paddingHorizontal: 16,
            fontSize: metrics.heading,
            lineHeight: metrics.headingLine,
            fontWeight: '700',
            textAlign: 'center',
            color: colors.text,
          }}>
          {me.name || t.you}
        </Text>
      </View>
      <SettingsRow icon="moon" title={t.darkMode}>
        <MessengerSwitch label={t.darkMode} checked={dark} change={setDark} />
      </SettingsRow>
      <SettingsRow
        icon="active"
        title={t.activityStatus}
        value={settings ? (settings.activityStatus ? t.enabled : t.disabled) : t.loading}
        onPress={() => navigation.navigate('Privacy')}
      />
      <Text
        style={{
          fontSize: 12,
          lineHeight: metrics.previewLine,
          color: colors.secondary,
          paddingHorizontal: 16,
          paddingTop: 28,
          paddingBottom: 8,
        }}>
        {t.preferences.toLocaleUpperCase()}
      </Text>
      <SettingsRow
        icon="profile"
        title={t.profileSettings}
        onPress={() => navigation.navigate('ProfileSettings')}
      />
      <SettingsRow
        icon="privacy"
        title={t.privacyHeading}
        onPress={() => navigation.navigate('Privacy')}
      />
      <SettingsRow icon="notifications" title={t.notificationsTitle} value={t.notAvailable} />
      <Text
        style={{
          paddingHorizontal: 16,
          paddingBottom: 12,
          fontSize: 12,
          lineHeight: 18,
          color: colors.secondary,
        }}>
        {t.pushNotConfigured}
      </Text>
      <SettingsRow
        icon="people"
        title={t.people}
        onPress={() => navigation.navigate('People', { mode: 'people' })}
      />
      <SettingsRow
        icon="discover"
        title={t.discover}
        onPress={() => navigation.navigate('People', { mode: 'discover' })}
      />
      <View style={{ paddingTop: 12 }}>{account}</View>
    </ScrollView>
  );
}

export function ProfileSettingsScreen({
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'ProfileSettings'>) {
  const me = useQuery(dziriApi.me, {});
  const { t, rtl } = useLocale();
  const colors = useColors();
  if (!me) return <Notice text={t.loading} busy />;
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}>
      <ScreenHeading title={t.profileSettings} back={() => navigation.goBack()} />
      {me.handle ? (
        <SettingsRow icon="username" title={t.username} value={`@${me.handle}`} />
      ) : null}
      {me.phone ? <SettingsRow icon="phone" title={t.phone} value={me.phone} /> : null}
      <View
        style={{
          minHeight: 60,
          marginHorizontal: 16,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          borderBottomWidth: 0.5,
          borderColor: colors.border,
        }}>
        <Text
          style={{
            fontSize: metrics.message,
            lineHeight: metrics.messageLine,
            color: colors.text,
            flex: 1,
          }}>
          {t.language}
        </Text>
        <LanguageMenu />
      </View>
    </ScrollView>
  );
}

export function PrivacyScreen({ navigation }: NativeStackScreenProps<MessengerRoutes, 'Privacy'>) {
  const capabilities = useQuery(dziriApi.capabilities, {});
  const me = useQuery(dziriApi.me, {});
  const presence = useQuery(dziriApi.presence, me ? { userIds: [me._id] } : 'skip');
  const settings = presence?.find(row => row.userId === me?._id)?.settings;
  const save = useMutation(dziriApi.savePreferences);
  const { t } = useLocale();
  const colors = useColors();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(false);
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
    <ScrollView
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeading title={t.privacyHeading} back={() => navigation.goBack()} />
      {capabilities?.features?.safety === 1 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('BlockedPeople')}
          style={{ minHeight: 60, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, color: colors.text }}>{t.blockedAccounts}</Text>
        </Pressable>
      ) : null}
      {(['activityStatus', 'lastSeen', 'readReceipts', 'typingIndicators'] as const).map(key => (
        <SettingsRow key={key} icon={preferenceIcons[key]} title={t[key]}>
          <MessengerSwitch
            label={t[key]}
            disabled={pending || !settings}
            checked={settings?.[key] ?? false}
            change={value => void change(key, value)}
          />
        </SettingsRow>
      ))}
      {error ? (
        <Text accessibilityRole="alert" style={{ padding: 16, color: colors.text }}>
          {t.failed}
        </Text>
      ) : null}
    </ScrollView>
  );
}
