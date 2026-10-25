import React, { memo, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from './typography';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { tailwind } from '../theme';
import { dziriApi, type ThreadSummary } from './api';
import { LanguageChoice, Notice, useColors } from './ui';
import { useLocale } from './locale';
import type { MessengerRoutes } from './routes';
import type { MessengerTab } from '../messenger-policy';

const InboxRow = memo(function InboxRow({
  thread,
  open,
}: {
  thread: ThreadSummary;
  open: (id: string) => void;
}) {
  const colors = useColors();
  const { t, rtl } = useLocale();
  const title = thread.title || thread.otherUser?.name || thread.otherUser?.handle || t.unknown;
  const image = thread.avatarUrl || thread.otherUser?.image;
  return (
    <Pressable
      onPress={() => open(thread._id)}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[
        tailwind.style('px-3 py-3 gap-3 items-center border-b'),
        {
          flexDirection: rtl ? 'row-reverse' : 'row',
          borderColor: colors.border,
        },
      ]}>
      {image ? (
        <Image source={{ uri: image }} style={tailwind.style('w-10 h-10 rounded-full')} />
      ) : (
        <View
          style={[
            tailwind.style('w-10 h-10 rounded-full items-center justify-center'),
            { backgroundColor: colors.surface },
          ]}>
          <Text style={{ color: colors.text }}>{title.slice(0, 1)}</Text>
        </View>
      )}
      <View style={tailwind.style('flex-1 gap-1')}>
        <Text
          numberOfLines={1}
          style={[
            tailwind.style('text-base font-inter-medium-24'),
            { color: colors.text, textAlign: rtl ? 'right' : 'left' },
          ]}>
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            tailwind.style('text-sm'),
            { color: colors.secondary, writingDirection: 'auto' },
          ]}>
          {thread.encryption === 'e2ee' ? t.encryptionUnavailable : thread.lastMessagePreview || ''}
        </Text>
      </View>
      {thread.unreadCount > 0 ? (
        <View
          style={[tailwind.style('rounded-full px-2 py-1'), { backgroundColor: colors.primary }]}>
          <Text style={tailwind.style('text-xs text-white')}>
            {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
          </Text>
        </View>
      ) : null}
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
  const threads = useQuery(dziriApi.laneThreads, lane === 'customers' ? 'skip' : { lane });
  const commerce = useQuery(dziriApi.commerce, lane === 'staff' ? 'skip' : { lane });
  const { t } = useLocale();
  const colors = useColors();
  const [search, setSearch] = useState('');
  const open = useCallback(
    (threadId: string) => navigation.navigate('Conversation', { threadId }),
    [navigation],
  );
  if (
    (lane !== 'customers' && threads === undefined) ||
    (lane !== 'staff' && commerce === undefined)
  )
    return <Notice text={t.loading} busy />;
  const filter = search.trim().toLocaleLowerCase();
  const visible = filter
    ? (threads ?? []).filter(thread =>
        `${thread.title ?? ''} ${thread.otherUser?.name ?? ''} ${thread.otherUser?.handle ?? ''}`
          .toLocaleLowerCase()
          .includes(filter),
      )
    : (threads ?? []);
  const shopRows = (commerce ?? []).filter(row =>
    `${row.title} ${row.context}`.toLocaleLowerCase().includes(filter),
  );
  const rows = [
    ...visible.map(thread => ({
      id: thread._id,
      at: thread.lastMessageAt,
      thread,
      commerce: null,
    })),
    ...shopRows.map(row => ({ id: row._id, at: row.lastMessageAt, thread: null, commerce: row })),
  ].sort((a, b) => b.at - a.at);
  return (
    <View style={[tailwind.style('flex-1'), { backgroundColor: colors.background }]}>
      {lane !== 'customers' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => (lane === 'staff' ? openSupportInbox() : navigation.navigate('Support'))}
          style={tailwind.style('p-4')}>
          <Text style={{ color: colors.primary }}>
            {lane === 'staff' ? t.supportQueues : t.support}
          </Text>
        </Pressable>
      ) : null}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t.chats}
        accessibilityLabel={t.chats}
        placeholderTextColor={colors.secondary}
        style={[
          tailwind.style('px-3 py-3 mx-3 my-2 rounded-[13px] text-base'),
          { color: colors.text, backgroundColor: colors.surface },
        ]}
      />
      <FlashList
        data={rows}
        renderItem={({ item }) =>
          item.thread ? (
            <InboxRow thread={item.thread} open={open} />
          ) : item.commerce ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.commerce.title}
              onPress={() =>
                navigation.navigate('Commerce', {
                  conversationId: item.id,
                  storeId: item.commerce?.storeId,
                })
              }
              style={[tailwind.style('p-4 border-b gap-1'), { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{item.commerce.title}</Text>
              {lane === 'customers' ? (
                <Text style={{ color: colors.secondary }}>{item.commerce.context}</Text>
              ) : null}
              <Text numberOfLines={1} style={{ color: colors.secondary }}>
                {item.commerce.lastMessagePreview}
              </Text>
            </Pressable>
          ) : null
        }
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <Text style={[tailwind.style('p-6 text-center'), { color: colors.secondary }]}>
            {lane === 'friends'
              ? t.friendsEmpty
              : lane === 'customers'
                ? t.customersEmpty
                : t.staffEmpty}
          </Text>
        }
      />
      <LanguageChoice />
    </View>
  );
}
