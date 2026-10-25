import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dziriApi } from './api';
import type { MessengerRoutes } from './routes';
import { useColors, Notice } from './ui';
import { useLocale } from './locale';
import { Text, TextInput } from './typography';
import { FigmaButton, FigmaIcon } from './figma';
export function DetailsScreen({
  route,
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'Details'>) {
  const { threadId, conversationId, storeId } = route.params;
  const thread = useQuery(dziriApi.thread, threadId ? { threadId } : 'skip');
  const commerce = useQuery(
    dziriApi.commerceDetail,
    conversationId ? { conversationId, ...(storeId ? { storeId } : {}) } : 'skip',
  );
  const messages = usePaginatedQuery(
    dziriApi.messages,
    threadId && thread && thread.encryption !== 'e2ee' ? { threadId } : 'skip',
    { initialNumItems: 30 },
  );
  const commerceMessages = useQuery(
    dziriApi.commerceMessages,
    conversationId && commerce
      ? { conversationId, ...(storeId ? { storeId } : {}), limit: 100 }
      : 'skip',
  );
  const mute = useMutation(dziriApi.muteThread);
  const { t, rtl } = useLocale();
  const colors = useColors();
  const [search, setSearch] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const name = thread?.title || commerce?.otherName || t.unknown;
  if (thread === null || commerce === null)
    return <Notice text={t.unavailable} onBack={() => navigation.goBack()} />;
  if ((threadId && !thread) || (conversationId && !commerce))
    return <Notice text={t.loading} busy onBack={() => navigation.goBack()} />;
  const rows = threadId
    ? messages.results.filter(m => m.deletedAt === undefined && !m.ciphertext)
    : (commerceMessages?.filter(m => m.deletedAt === undefined) ?? []);
  async function toggleMute() {
    if (!threadId || busy) return;
    setBusy(true);
    setError(false);
    try {
      await mute({
        threadId,
        untilMs: (thread?.mutedUntil ?? 0) > Date.now() ? 0 : Date.now() + 86400000,
      });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 52, paddingHorizontal: 8 }}>
        <FigmaButton name="back" label={t.close} onPress={() => navigation.goBack()} />
      </View>
      <View style={{ alignItems: 'center', gap: 8, paddingBottom: 28 }}>
        {thread?.avatarUrl ? (
          <Image
            source={{ uri: thread.avatarUrl }}
            style={{ width: 100, height: 100, borderRadius: 50 }}
          />
        ) : (
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text style={{ fontSize: 32, color: colors.secondary }}>{name[0]}</Text>
          </View>
        )}
        <Text
          accessibilityRole="header"
          style={{ fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.text }}>
          {name}
        </Text>
        <Text style={{ fontSize: 15, color: colors.secondary }}>
          {commerce?.storeName || t.app}
        </Text>
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 24, paddingTop: 12 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('People', { mode: 'people' })}
            style={{ alignItems: 'center', gap: 6 }}>
            <FigmaIcon name="profileUser" />
            <Text style={{ fontSize: 13, color: colors.secondary }}>{t.people}</Text>
          </Pressable>
          {threadId ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void toggleMute()}
              style={{ alignItems: 'center', gap: 6 }}>
              <FigmaIcon name="profileMute" />
              <Text style={{ fontSize: 13, color: colors.secondary }}>
                {(thread?.mutedUntil ?? 0) > Date.now() ? t.unmute : t.mute}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={{ padding: 16, color: colors.text }}>
          {t.failed}
        </Text>
      ) : null}
      <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text style={{ fontSize: 13, color: colors.secondary, paddingBottom: 12 }}>
          {t.searchMessages.toUpperCase()}
        </Text>
        <TextInput
          accessibilityLabel={t.searchMessages}
          placeholder={t.searchMessages}
          placeholderTextColor={colors.secondary}
          value={search}
          onChangeText={setSearch}
          style={{
            minHeight: 36,
            padding: 10,
            borderRadius: 10,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 15,
          }}
        />
        {search.trim()
          ? rows
              .filter(row =>
                ('content' in row ? row.content : row.body)
                  ?.toLocaleLowerCase()
                  .includes(search.trim().toLocaleLowerCase()),
              )
              .map(row => (
                <View
                  key={row._id}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 0.5,
                    borderColor: colors.border,
                  }}>
                  <Text style={{ fontSize: 13, color: colors.secondary }}>{row.senderName}</Text>
                  <Text selectable style={{ fontSize: 15, color: colors.text }}>
                    {'content' in row ? row.content : row.body}
                  </Text>
                </View>
              ))
          : null}
        <Text style={{ fontSize: 13, color: colors.secondary, paddingVertical: 20 }}>
          {t.media.toUpperCase()}
        </Text>
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
          {messages.results
            .filter(
              m =>
                m.deletedAt === undefined &&
                m.type === 'image' &&
                m.mediaUrl &&
                m.moderationStatus !== 'blocked' &&
                m.moderationStatus !== 'blurred',
            )
            .map(m => (
              <Image
                key={m._id}
                source={{ uri: m.mediaUrl }}
                contentFit="cover"
                style={{ width: 100, height: 100, borderRadius: 12 }}
              />
            ))}
        </View>
        {messages.status === 'CanLoadMore' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => messages.loadMore(30)}
            style={{ padding: 16 }}>
            <Text style={{ color: colors.primary }}>{t.older}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}
