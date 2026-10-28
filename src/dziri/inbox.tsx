import { safetyCopy } from './messenger-safety.generated';
import { staffCopy } from './messenger-staff.generated';
import { messengerMetrics as metrics } from './colors';
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
import { FigmaButton, FigmaIcon } from './figma';
import type { MessengerRoutes } from './routes';
import type { MessengerTab } from '../messenger-policy';
import { StoriesStrip } from './stories-strip';
import { StoryComposer } from './story-composer';
import { SwipeConversation } from './swipe-conversation';
import { newConversationTarget } from './workspace-layout';
import type { WorkspaceSelection } from './workspace-sidebar';

type Row = {
  id: string;
  kind: 'thread' | 'commerce';
  title: string;
  preview: string;
  image?: string;
  at: number;
  unread: number;
  unreadIsMarker?: boolean;
  context?: string;
  storeId?: string;
  pinned?: boolean;
  archived?: boolean;
  organization?: boolean;
  selected?: boolean;
};
const ConversationRow = memo(function ConversationRow({
  row,
  open,
  details,
}: {
  row: Row;
  open: (row: Row) => void;
  details: (row: Row) => void;
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
            ? { numberingSystem: 'latn', hour: '2-digit', minute: '2-digit' }
            : { numberingSystem: 'latn', month: 'short', day: 'numeric' },
        )
      : '';
  const initials = row.title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0])
    .join('');
  return (
    <SwipeConversation
      threadId={row.kind === 'thread' ? row.id : undefined}
      organization={
        row.organization
          ? { pinned: !!row.pinned, archived: !!row.archived, unread: row.unread > 0 }
          : undefined
      }
      details={() => details(row)}>
      {(showActions, canOpen) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={row.title}
          accessibilityState={{ selected: !!row.selected }}
          onPress={() => {
            if (canOpen()) open(row);
          }}
          onLongPress={showActions}
          style={({ pressed }) => ({
            paddingHorizontal: 16,
            paddingVertical: 8,
            minHeight: row.context ? 84 : 76,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: pressed || row.selected ? colors.surface : colors.background,
          })}>
          {row.image ? (
            <Image
              source={{ uri: row.image }}
              style={{
                width: metrics.inboxAvatar,
                height: metrics.inboxAvatar,
                borderRadius: metrics.inboxAvatar / 2,
              }}
            />
          ) : (
            <View
              style={{
                width: metrics.inboxAvatar,
                height: metrics.inboxAvatar,
                borderRadius: metrics.inboxAvatar / 2,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.secondary }}>
                {initials}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 0 }}>
            <View
              style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: metrics.message,
                  lineHeight: metrics.messageLine,
                  fontWeight: row.unread ? '700' : '500',
                  color: colors.text,
                  textAlign: rtl ? 'right' : 'left',
                }}>
                {row.title}
              </Text>
              {row.pinned ? <Icon name="pin" size={14} color={colors.secondary} /> : null}
            </View>
            {row.context ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 12,
                  color: colors.secondary,
                  textAlign: rtl ? 'right' : 'left',
                }}>
                {row.context}
              </Text>
            ) : null}
            <View
              style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: metrics.preview,
                  lineHeight: metrics.previewLine,
                  color: colors.secondary,
                  textAlign: rtl ? 'right' : 'left',
                  writingDirection: 'auto',
                }}>
                {row.preview || t.noMessages}
                {time ? ` · ${time}` : ''}
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
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.onPrimary }}>
                    {row.unreadIsMarker ? '•' : row.unread > 99 ? '99+' : row.unread}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      )}
    </SwipeConversation>
  );
});

export function InboxScreen({
  navigation,
  lane,
  openSupportInbox,
  selection,
}: NativeStackScreenProps<MessengerRoutes, 'Chats'> & {
  lane: MessengerTab;
  openSupportInbox: () => void;
  selection?: WorkspaceSelection;
}) {
  const capabilities = useQuery(dziriApi.capabilities, {});
  const organization = capabilities?.features?.inboxOrganization === 1;
  const [view, setView] = useState<'all' | 'unread' | 'archived'>('all');
  const archived = organization && view === 'archived' && lane !== 'marketplace';
  const threads = useQuery(
    dziriApi.laneThreads,
    lane === 'marketplace' ? 'skip' : { lane, ...(archived ? { archived: true } : {}) },
  );
  const commerce = useQuery(dziriApi.commerce, lane === 'marketplace' ? { lane } : 'skip');
  const me = useQuery(dziriApi.me, {});
  const { t, rtl, locale } = useLocale();
  const colors = useColors();
  const supportCompany = useSupportCompanyId();
  const [search, setSearch] = useState('');
  const [cameraStory, setCameraStory] = useState(false);
  const open = useCallback(
    (row: Row) => {
      if (row.kind === 'commerce')
        navigation.navigate('Commerce', { conversationId: row.id, storeId: row.storeId });
      else
        navigation.navigate('Conversation', {
          threadId: row.id,
          lane: lane === 'staff' ? 'staff' : 'friends',
        });
    },
    [navigation, lane],
  );
  const details = useCallback(
    (row: Row) =>
      navigation.navigate(
        'Details',
        row.kind === 'thread'
          ? { threadId: row.id }
          : { conversationId: row.id, storeId: row.storeId },
      ),
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
          unread: Number(row.hasUnread ?? false),
          unreadIsMarker: true,
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
          unreadIsMarker: thread.unreadCountComplete === false,
          pinned: thread.pinnedAt !== undefined,
          archived,
          organization,
        }));
  const filter = search.trim().toLocaleLowerCase();
  const visible = rows.filter(
    row =>
      (view !== 'unread' || row.unread > 0) &&
      `${row.title} ${row.context ?? ''}`.toLocaleLowerCase().includes(filter),
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          height: 64,
          paddingHorizontal: 16,
          gap: 12,
          alignItems: 'center',
          flexDirection: rtl ? 'row-reverse' : 'row',
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.settings}
          onPress={() => navigation.navigate('Settings')}>
          {me?.image ? (
            <Image source={{ uri: me.image }} style={{ width: 40, height: 40, borderRadius: 20 }} />
          ) : (
            <Image
              source={require('../../assets/dziri-ring.svg')}
              style={{ width: 40, height: 40 }}
            />
          )}
        </Pressable>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: metrics.heading,
            lineHeight: metrics.headingLine,
            fontWeight: '700',
            color: colors.text,
          }}>
          {lane === 'friends' ? t.chats : lane === 'marketplace' ? t.marketplaceTab : t.teamView}
        </Text>
        {lane === 'friends' ? (
          <FigmaButton name="cameraTop" label={t.camera} onPress={() => setCameraStory(true)} />
        ) : null}
        <FigmaButton
          name="newMessage"
          label={t.newMessage}
          onPress={() => {
            const target = newConversationTarget(lane);
            if (target === 'staffInbox') openSupportInbox();
            else
              navigation.navigate(
                'People',
                target === 'businesses' ? { mode: 'discover', businesses: true } : { mode: 'new' },
              );
          }}
        />
      </View>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 8,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 8,
        }}>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            height: 36,
            paddingHorizontal: 8,
            borderRadius: 10,
            backgroundColor: colors.surface,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
          }}>
          <FigmaIcon name="search" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.searchConversations}
            accessibilityLabel={t.searchConversations}
            placeholderTextColor={colors.secondary}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 14,
              lineHeight: 20,
              paddingVertical: 6,
              color: colors.text,
            }}
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
      {cameraStory ? <StoryComposer initialCamera close={() => setCameraStory(false)} /> : null}
      {lane === 'staff' && capabilities?.features?.staffSetup === 1 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('StaffSetup')}
          style={{ minHeight: 44, paddingHorizontal: 20, justifyContent: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 14, textAlign: rtl ? 'right' : 'left' }}>
            {staffCopy(locale).title}
          </Text>
        </Pressable>
      ) : null}
      {lane !== 'marketplace' || organization ? (
        <View
          style={{
            flexDirection: rtl ? 'row-reverse' : 'row',
            paddingHorizontal: 16,
            gap: 8,
            paddingVertical: 8,
          }}>
          {(
            [
              'all',
              'unread',
              ...(organization && lane !== 'marketplace' ? (['archived'] as const) : []),
            ] as const
          ).map(value => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: view === value }}
              onPress={() => setView(value)}
              style={{
                minHeight: 36,
                paddingHorizontal: 14,
                borderRadius: 18,
                justifyContent: 'center',
                backgroundColor: view === value ? colors.surface : colors.background,
              }}>
              <Text
                style={{ fontSize: 13, color: view === value ? colors.text : colors.secondary }}>
                {value === 'all'
                  ? t.allChats
                  : value === 'unread'
                    ? t.unreadChats
                    : t.archivedChats}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {lane === 'friends' && capabilities?.features?.messageRequests === 1 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Requests')}
          style={{ minHeight: 44, paddingHorizontal: 20, justifyContent: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 14, textAlign: rtl ? 'right' : 'left' }}>
            {safetyCopy(locale).requests}
          </Text>
        </Pressable>
      ) : null}
      {lane === 'friends' && !search.trim() && view === 'all' ? (
        <StoriesStrip
          openConversation={threadId =>
            navigation.navigate('Conversation', { threadId, lane: 'friends' })
          }
        />
      ) : null}
      <FlashList
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        data={visible}
        renderItem={({ item }) => (
          <ConversationRow
            row={{
              ...item,
              selected:
                item.kind === 'thread'
                  ? selection?.threadId === item.id
                  : selection?.conversationId === item.id && selection?.storeId === item.storeId,
            }}
            open={open}
            details={details}
          />
        )}
        keyExtractor={row => row.id}
        ListEmptyComponent={
          <Text
            style={{ padding: 32, textAlign: 'center', color: colors.secondary, lineHeight: 22 }}>
            {filter
              ? t.noResults
              : lane === 'friends'
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
