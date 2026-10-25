import React, { memo, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from './typography';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dziriApi } from './api';
import { Notice, useColors } from './ui';
import { useLocale } from './locale';
import { useSupportCompanyId } from './support';
import { Icon, IconButton } from './icons';
import type { MessengerRoutes } from './routes';
import type { MessengerTab } from '../messenger-policy';

type Row = {
  id: string;
  kind: 'thread' | 'commerce';
  title: string;
  preview: string;
  image?: string;
  at: number;
  unread: number;
  context?: string;
  storeId?: string;
};
const ConversationRow = memo(function ConversationRow({
  row,
  open,
}: {
  row: Row;
  open: (row: Row) => void;
}) {
  const colors = useColors();
  const { rtl, locale, t } = useLocale();
  const date = new Date(row.at),
    now = new Date();
  const time =
    row.preview && row.at > 0
      ? date.toLocaleString(
          locale,
          date.toDateString() === now.toDateString()
            ? { hour: '2-digit', minute: '2-digit' }
            : { month: 'short', day: 'numeric' },
        )
      : '';
  const initials = row.title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0])
    .join('');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.title}
      onPress={() => open(row)}
      style={({ pressed }) => ({
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 84,
        flexDirection: rtl ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surface : colors.background,
      })}>
      {row.image ? (
        <Image source={{ uri: row.image }} style={{ width: 48, height: 48, borderRadius: 24 }} />
      ) : (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.secondary }}>
            {initials}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 16,
              fontWeight: '600',
              color: colors.text,
              textAlign: rtl ? 'right' : 'left',
            }}>
            {row.title}
          </Text>
          {time ? <Text style={{ fontSize: 11, color: colors.secondary }}>{time}</Text> : null}
        </View>
        {row.context ? (
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, color: colors.secondary, textAlign: rtl ? 'right' : 'left' }}>
            {row.context}
          </Text>
        ) : null}
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 14,
              lineHeight: 20,
              color: colors.secondary,
              textAlign: rtl ? 'right' : 'left',
              writingDirection: 'auto',
            }}>
            {row.preview || t.noMessages}
          </Text>
          {row.unread > 0 ? (
            <View
              style={{
                minWidth: 20,
                paddingHorizontal: 6,
                height: 20,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.primary,
              }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>
                {row.unread > 99 ? '99+' : row.unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

export function InboxScreen({
  navigation,
  lane,
  openSupportInbox,
}: NativeStackScreenProps<MessengerRoutes, 'Chats'> & {
  lane: MessengerTab;
  openSupportInbox: () => void;
}) {
  const threads = useQuery(dziriApi.laneThreads, lane === 'marketplace' ? 'skip' : { lane });
  const commerce = useQuery(dziriApi.commerce, lane === 'marketplace' ? { lane } : 'skip');
  const { t, rtl } = useLocale();
  const colors = useColors();
  const supportCompany = useSupportCompanyId();
  const [search, setSearch] = useState('');
  const open = useCallback(
    (row: Row) => {
      if (row.kind === 'commerce')
        navigation.navigate('Commerce', { conversationId: row.id, storeId: row.storeId });
      else navigation.navigate('Conversation', { threadId: row.id });
    },
    [navigation],
  );
  if (lane === 'marketplace' ? commerce === undefined : threads === undefined)
    return <Notice text={t.loading} busy />;
  const rows: Row[] =
    lane === 'marketplace'
      ? (commerce ?? []).map(row => ({
          id: row._id,
          kind: 'commerce',
          title: row.title,
          preview: row.lastMessagePreview,
          image: row.avatarUrl,
          at: row.lastMessageAt,
          unread: 0,
          context: `${row.side === 'selling' ? t.selling : t.buying} · ${row.context}`,
          storeId: row.storeId,
        }))
      : (threads ?? []).map(thread => ({
          id: thread._id,
          kind: 'thread',
          title: thread.title || thread.otherUser?.name || thread.otherUser?.handle || t.unknown,
          image: thread.avatarUrl || thread.otherUser?.image,
          preview:
            thread.encryption === 'e2ee'
              ? t.encryptionUnavailable
              : (thread.lastMessagePreview ?? ''),
          at: thread.lastMessageAt,
          unread: thread.unreadCount,
        }));
  const filter = search.trim().toLocaleLowerCase();
  const visible = rows.filter(row =>
    `${row.title} ${row.context ?? ''}`.toLocaleLowerCase().includes(filter),
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 8,
        }}>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: colors.surface,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
          }}>
          <Icon name="search" color={colors.secondary} size={18} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.searchConversations}
            accessibilityLabel={t.searchConversations}
            placeholderTextColor={colors.secondary}
            style={{ flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 12, color: colors.text }}
          />
        </View>
        {lane === 'staff' || (lane === 'friends' && supportCompany) ? (
          <IconButton
            name="support"
            label={lane === 'staff' ? t.supportQueues : t.support}
            color={colors.secondary}
            onPress={() => (lane === 'staff' ? openSupportInbox() : navigation.navigate('Support'))}
          />
        ) : null}
      </View>
      <FlashList
        data={visible}
        renderItem={({ item }) => <ConversationRow row={item} open={open} />}
        keyExtractor={row => row.id}
        ListEmptyComponent={
          <Text
            style={{ padding: 32, textAlign: 'center', color: colors.secondary, lineHeight: 22 }}>
            {lane === 'friends'
              ? t.friendsEmpty
              : lane === 'marketplace'
                ? t.marketplaceEmpty
                : t.staffEmpty}
          </Text>
        }
      />
    </View>
  );
}
