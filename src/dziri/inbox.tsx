import React, { memo, useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { tailwind } from '../theme';
import { dziriApi, type ThreadSummary } from './api';
import { LanguageChoice, Notice, useColors } from './ui';
import { useLocale } from './locale';
import type { MessengerRoutes } from './routes';

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

export function InboxScreen({ navigation }: NativeStackScreenProps<MessengerRoutes, 'Chats'>) {
  const threads = useQuery(dziriApi.threads, {});
  const { t } = useLocale();
  const colors = useColors();
  const [search, setSearch] = useState('');
  const open = useCallback(
    (threadId: string) => navigation.navigate('Conversation', { threadId }),
    [navigation],
  );
  const renderItem = useCallback(
    ({ item }: { item: ThreadSummary }) => <InboxRow thread={item} open={open} />,
    [open],
  );
  if (threads === undefined) return <Notice text={t.loading} busy />;
  const filter = search.trim().toLocaleLowerCase();
  const visible = filter
    ? threads.filter(thread =>
        `${thread.title ?? ''} ${thread.otherUser?.name ?? ''} ${thread.otherUser?.handle ?? ''}`
          .toLocaleLowerCase()
          .includes(filter),
      )
    : threads;
  return (
    <View style={[tailwind.style('flex-1'), { backgroundColor: colors.background }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Support')}
        style={tailwind.style('p-4')}>
        <Text style={{ color: colors.primary }}>{t.support}</Text>
      </Pressable>
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
        data={visible}
        renderItem={renderItem}
        keyExtractor={threadKey}
        ListEmptyComponent={
          <Text style={[tailwind.style('p-6 text-center'), { color: colors.secondary }]}>
            {t.empty}
          </Text>
        }
      />
      <LanguageChoice />
    </View>
  );
}

function threadKey(thread: ThreadSummary) {
  return thread._id;
}
