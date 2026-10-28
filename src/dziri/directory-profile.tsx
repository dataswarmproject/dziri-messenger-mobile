import React, { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dziriApi } from './api';
import type { MessengerRoutes } from './routes';
import { Text } from './typography';
import { FigmaButton, FigmaIcon } from './figma';
import { PersonAvatar } from './screen-parts';
import { Notice, useColors } from './ui';
import { useLocale } from './locale';
import { SafetyAction } from './safety';

function DirectoryProfile({
  name,
  image,
  subtitle,
  description,
  back,
  children,
}: {
  name: string;
  image?: string | null;
  subtitle?: string;
  description?: string;
  back: () => void;
  children: ReactNode;
}) {
  const colors = useColors();
  const { t, rtl } = useLocale();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}>
      <View
        style={{ height: 52, paddingHorizontal: 8, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
        <FigmaButton name="back" label={t.back} onPress={back} />
      </View>
      <View style={{ alignItems: 'center', paddingHorizontal: 24, gap: 8 }}>
        <PersonAvatar image={image} name={name} size={100} />
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 22,
            lineHeight: 28,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
            marginTop: 8,
          }}>
          {name}
        </Text>
        {subtitle ? (
          <Text
            style={{ fontSize: 13, lineHeight: 18, color: colors.secondary, textAlign: 'center' }}>
            {subtitle}
          </Text>
        ) : null}
        {description ? (
          <Text
            selectable
            style={{
              fontSize: 15,
              lineHeight: 21,
              color: colors.text,
              textAlign: 'center',
              paddingVertical: 12,
            }}>
            {description}
          </Text>
        ) : null}
        {children}
      </View>
    </ScrollView>
  );
}

function MessageAction({
  busy,
  disabled,
  open,
}: {
  busy: boolean;
  disabled: boolean;
  open: () => void;
}) {
  const { t } = useLocale();
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.message}
      aria-busy={busy}
      disabled={disabled || busy}
      accessibilityState={{ disabled: disabled || busy }}
      onPress={open}
      style={{
        minWidth: 80,
        minHeight: 64,
        marginTop: 12,
        alignItems: 'center',
        gap: 6,
        opacity: disabled ? 0.5 : 1,
      }}>
      <View style={{ height: 40, width: 40, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <ActivityIndicator color={colors.primary} /> : <FigmaIcon name="peopleRequests" />}
      </View>
      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.secondary }}>{t.message}</Text>
    </Pressable>
  );
}

export function StoreProfileScreen({
  route,
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'StoreProfile'>) {
  const store = useQuery(dziriApi.publicStore, { slug: route.params.slug });
  const me = useQuery(dziriApi.me, {});
  const start = useMutation(dziriApi.startStoreConversation);
  const { t } = useLocale();
  const colors = useColors();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  if (store === undefined)
    return <Notice text={t.loading} busy onBack={() => navigation.goBack()} />;
  if (!store) return <Notice text={t.unavailable} onBack={() => navigation.goBack()} />;
  async function message() {
    if (!store || !me || busy || store.ownerId === me._id) return;
    setBusy(true);
    setError(false);
    try {
      // The existing server derives the buyer/seller and reuses the canonical store DM.
      const conversationId = await start({ storeId: store._id });
      navigation.navigate('Commerce', { conversationId });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <DirectoryProfile
      name={store.name}
      image={store.logoUrl}
      subtitle={t.businesses}
      description={store.description}
      back={() => navigation.goBack()}>
      {store.ownerId === me?._id ? (
        <Text style={{ fontSize: 13, lineHeight: 18, color: colors.secondary, paddingTop: 16 }}>
          {t.yourStore}
        </Text>
      ) : (
        <MessageAction busy={busy} disabled={!me} open={() => void message()} />
      )}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: 13, lineHeight: 18, color: colors.primary, paddingTop: 12 }}>
          {t.conversationStartFailed}
        </Text>
      ) : null}
    </DirectoryProfile>
  );
}

export function ProfileScreen({
  route,
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'Profile'>) {
  const profile = useQuery(dziriApi.publicProfile, { userId: route.params.userId });
  const capabilities = useQuery(dziriApi.capabilities, {});
  const me = useQuery(dziriApi.me, {});
  const threads = useQuery(dziriApi.laneThreads, { lane: 'friends' });
  const create = useMutation(dziriApi.createDm);
  const { t } = useLocale();
  const colors = useColors();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  if (profile === undefined)
    return <Notice text={t.loading} busy onBack={() => navigation.goBack()} />;
  if (!profile) return <Notice text={t.unavailable} onBack={() => navigation.goBack()} />;
  async function message() {
    if (!profile || !me || busy || profile._id === me._id) return;
    setBusy(true);
    setError(false);
    try {
      const existing = threads?.find(
        thread => thread.type === 'dm' && thread.otherUser?._id === profile._id,
      );
      const threadId = existing?._id ?? (await create({ otherUserId: profile._id }));
      navigation.navigate('Conversation', { threadId });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <DirectoryProfile
      name={profile.name}
      image={profile.image}
      subtitle={profile.handle ? `@${profile.handle}` : undefined}
      description={profile.bio || profile.professionalHeadline}
      back={() => navigation.goBack()}>
      {profile._id !== me?._id ? (
        <MessageAction
          busy={busy}
          disabled={!me || threads === undefined}
          open={() => void message()}
        />
      ) : null}
      {profile._id !== me?._id && capabilities?.features?.safety === 1 ? (
        <SafetyAction key={profile._id} userId={profile._id} name={profile.name} />
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: 13, lineHeight: 18, color: colors.primary, paddingTop: 12 }}>
          {t.conversationStartFailed}
        </Text>
      ) : null}
    </DirectoryProfile>
  );
}
