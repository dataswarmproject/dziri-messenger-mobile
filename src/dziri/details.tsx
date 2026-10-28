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
import { SharedMedia } from './shared-media';
import { displayMedia } from './message-policy';
import { historyMatches } from './history-policy.generated';
import { useHistorySearch } from './use-history-search.generated';
import { PinnedMessages } from './pinned-messages';
import { GroupControls } from './group-controls';
import { SafetyAction } from './safety';
export function DetailsScreen(props: NativeStackScreenProps<MessengerRoutes, 'Details'>) {
  return (
    <Details
      key={`${props.route.params.threadId ?? props.route.params.conversationId}:${props.route.params.storeId ?? 'buyer'}`}
      {...props}
    />
  );
}
function Details({ route, navigation }: NativeStackScreenProps<MessengerRoutes, 'Details'>) {
  const { threadId, conversationId, storeId } = route.params;
  const capabilities = useQuery(dziriApi.capabilities, {});
  const historyPages = capabilities?.features?.historyPages === 1;
  const thread = useQuery(dziriApi.thread, threadId ? { threadId } : 'skip');
  const summaries = useQuery(dziriApi.laneThreads, threadId ? { lane: 'friends' } : 'skip');
  const peer = summaries?.find(row => row._id === threadId)?.otherUser;
  const commerce = useQuery(
    dziriApi.commerceDetail,
    conversationId ? { conversationId, ...(storeId ? { storeId } : {}) } : 'skip',
  );
  const messages = usePaginatedQuery(
    dziriApi.messages,
    threadId && thread && thread.encryption !== 'e2ee' ? { threadId } : 'skip',
    { initialNumItems: 30 },
  );
  const commercePage = usePaginatedQuery(
    dziriApi.commercePage,
    conversationId && commerce && historyPages
      ? { conversationId, ...(storeId ? { storeId } : {}) }
      : 'skip',
    { initialNumItems: 30 },
  );
  const recentMessages = useQuery(
    dziriApi.commerceMessages,
    conversationId && commerce && !historyPages
      ? { conversationId, ...(storeId ? { storeId } : {}), limit: 100 }
      : 'skip',
  );
  const commerceMessages = historyPages ? commercePage.results : (recentMessages ?? []);
  const mute = useMutation(dziriApi.muteThread);
  const { t, rtl, locale } = useLocale();
  const colors = useColors();
  const [search, setSearch] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [callInfo, setCallInfo] = useState(false);
  const page = threadId ? messages : commercePage;
  const scan = useHistorySearch(
    search,
    threadId ? thread?.encryption !== 'e2ee' : historyPages,
    page.status,
    page.results.length,
    page.loadMore,
  );
  const matches = threadId
    ? historyMatches(messages.results, search, locale)
    : historyMatches(commerceMessages, search, locale);
  const name = thread?.title || commerce?.otherName || t.unknown;
  const avatar = thread?.avatarUrl || commerce?.otherImage;
  if (thread === null || commerce === null)
    return <Notice text={t.unavailable} onBack={() => navigation.goBack()} />;
  if ((threadId && !thread) || (conversationId && !commerce))
    return <Notice text={t.loading} busy onBack={() => navigation.goBack()} />;
  const shared = threadId
    ? messages.results.map(message => {
        const media = displayMedia(message);
        return {
          id: message._id,
          body: message.body,
          media,
          deletedAt: message.deletedAt,
          ciphertext: message.ciphertext,
          moderationStatus: message.moderationStatus,
        };
      })
    : (commerceMessages ?? []).flatMap(message =>
        message.deletedAt === undefined
          ? [
              { id: `${message._id}-text`, body: message.content },
              ...(message.imageUrls ?? []).map((uri, index) => ({
                id: `${message._id}-${index}`,
                body: message.content,
                media: { type: 'image' as const, uri },
              })),
            ]
          : [],
      );
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
    <ScrollView
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{ height: 52, paddingHorizontal: 8, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
        <FigmaButton name="back" label={t.close} onPress={() => navigation.goBack()} />
      </View>
      <View style={{ alignItems: 'center', gap: 8, paddingBottom: 28 }}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={{ width: 100, height: 100, borderRadius: 50 }} />
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
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 12, paddingTop: 12 }}>
          {(['profileAudio', 'profileVideo'] as const).map((icon, index) => (
            <Pressable
              key={icon}
              accessibilityRole="button"
              accessibilityLabel={index ? t.videoCall : t.voiceCall}
              accessibilityState={{ expanded: callInfo }}
              onPress={() => setCallInfo(value => !value)}
              style={{ width: 64, minHeight: 64, alignItems: 'center', gap: 6 }}>
              <FigmaIcon name={icon} />
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 18,
                  textAlign: 'center',
                  color: colors.secondary,
                }}>
                {index ? t.video : t.audio}
              </Text>
            </Pressable>
          ))}
          {peer ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.profile}
              onPress={() => navigation.navigate('Profile', { userId: peer._id })}
              style={{ width: 64, minHeight: 64, alignItems: 'center', gap: 6 }}>
              <FigmaIcon name="profileUser" />
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.secondary }}>
                {t.profile}
              </Text>
            </Pressable>
          ) : null}
          {threadId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={(thread?.mutedUntil ?? 0) > Date.now() ? t.unmute : t.mute}
              disabled={busy}
              onPress={() => void toggleMute()}
              style={{ width: 64, minHeight: 64, alignItems: 'center', gap: 6 }}>
              <FigmaIcon name="profileMute" />
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.secondary }}>
                {(thread?.mutedUntil ?? 0) > Date.now() ? t.unmute : t.muteCompact}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {callInfo ? (
          <Text
            accessibilityRole="alert"
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: colors.secondary,
              textAlign: 'center',
              paddingHorizontal: 24,
            }}>
            {t.callUnavailable}
          </Text>
        ) : null}
      </View>
      {thread?.type === 'dm' &&
      capabilities?.features?.safety === 1 &&
      (thread.peerUserId || peer?._id) ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <SafetyAction
            key={thread.peerUserId || peer?._id}
            userId={(thread.peerUserId || peer?._id)!}
            name={name}
          />
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ padding: 16, color: colors.text }}>
          {t.failed}
        </Text>
      ) : null}
      {threadId &&
      capabilities?.features?.inboxOrganization === 1 &&
      thread?.encryption !== 'e2ee' ? (
        <PinnedMessages
          threadId={threadId}
          open={id =>
            navigation.navigate('Conversation', {
              threadId,
              lane: route.params.lane,
              focusMessageId: id,
            })
          }
        />
      ) : null}
      {threadId && capabilities?.features?.groupManagement === 1 && thread?.isSocialGroup ? (
        <GroupControls
          key={threadId}
          threadId={threadId}
          title={name}
          role={thread.myRole}
          writable={!thread.isFrozen && thread.canSend !== false && thread.encryption === 'server'}
          leave={() => navigation.popToTop()}
        />
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
        {search.trim() ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ paddingVertical: 12, fontSize: 12, color: colors.secondary }}>
            {search.trim().length < 2
              ? t.searchTwoCharacters
              : `${matches.length} ${scan.complete && (threadId || historyPages) ? t.searchComplete : t.searchSoFar}`}
            {scan.scanning ? ` · ${t.searchingHistory}` : ''}
          </Text>
        ) : null}
        {conversationId && !historyPages ? (
          <Text style={{ paddingVertical: 12, fontSize: 12, color: colors.secondary }}>
            {t.historyLimited}
          </Text>
        ) : null}
        {scan.paused ? (
          <Pressable
            accessibilityRole="button"
            onPress={scan.continueSearch}
            style={{ paddingVertical: 14 }}>
            <Text style={{ color: colors.primary }}>{t.searchOlder}</Text>
          </Pressable>
        ) : null}
        {thread?.encryption === 'e2ee' ? (
          <Text style={{ paddingVertical: 12, color: colors.secondary }}>
            {t.encryptionUnavailable}
          </Text>
        ) : (
          matches.map(row => (
            <Pressable
              key={row._id}
              accessibilityRole="button"
              onPress={() =>
                threadId
                  ? navigation.navigate('Conversation', {
                      threadId,
                      lane: route.params.lane,
                      focusMessageId: row._id,
                    })
                  : conversationId &&
                    navigation.navigate('Commerce', {
                      conversationId,
                      storeId,
                      focusMessageId: row._id,
                    })
              }
              style={{
                paddingVertical: 12,
                borderBottomWidth: 0.5,
                borderColor: colors.border,
              }}>
              <Text style={{ fontSize: 13, color: colors.secondary }}>{row.senderName}</Text>
              <Text numberOfLines={3} style={{ fontSize: 15, color: colors.text }}>
                {'content' in row ? row.content : row.body}
              </Text>
              <Text style={{ fontSize: 11, color: colors.secondary }}>
                {new Date(row.createdAt).toLocaleString(locale, {
                  numberingSystem: 'latn',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </Pressable>
          ))
        )}
        {thread?.encryption !== 'e2ee' ? (
          <SharedMedia
            rows={shared}
            status={page.status}
            loadMore={() => page.loadMore(50)}
            limited={!!conversationId && !historyPages}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}
