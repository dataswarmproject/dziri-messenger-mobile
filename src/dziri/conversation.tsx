import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
  type ViewToken,
} from 'react-native';
import { Text, TextInput } from './typography';
import { FlashList } from '@shopify/flash-list';
import { useConvexConnectionState, useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { randomUUID } from 'expo-crypto';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { tailwind } from '../theme';
import { dziriApi, type MessageRecord } from './api';
import { createTextSender } from './text-sender';
import { canSendText, messageText, storedReceipt } from './message-policy';
import { useLocale } from './locale';
import { Notice, useColors } from './ui';
import type { MessengerRoutes } from './routes';
import { SupportConnection } from './support';

const MessageBubble = memo(function MessageBubble({
  message,
  myId,
  peerReadAt,
}: {
  message: MessageRecord;
  myId: string;
  peerReadAt?: number;
}) {
  const colors = useColors();
  const { t } = useLocale();
  const mine = message.senderId === myId;
  const receipt = storedReceipt(message, myId, peerReadAt);
  return (
    <View style={[tailwind.style('px-3 py-1'), { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
      <View
        style={[
          tailwind.style('pl-3 pr-2.5 py-2 rounded-2xl'),
          {
            maxWidth: '85%',
            backgroundColor: mine ? colors.outgoing : colors.surface,
          },
        ]}>
        {!mine && message.senderName ? (
          <Text style={[tailwind.style('text-xs pb-1'), { color: colors.secondary }]}>
            {message.senderName}
          </Text>
        ) : null}
        <Text
          selectable
          style={[
            tailwind.style('text-base leading-[22px] font-inter-normal-20'),
            {
              color: mine ? colors.outgoingText : colors.text,
              writingDirection: 'auto',
            },
          ]}>
          {messageText(message, t)}
        </Text>
        {receipt ? (
          <Text
            style={[
              tailwind.style('text-xs pt-1'),
              { color: colors.outgoingText, textAlign: 'right' },
            ]}>
            {t[receipt]}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

export function ConversationScreen(props: NativeStackScreenProps<MessengerRoutes, 'Conversation'>) {
  // A different thread must never inherit the previous conversation's retry key/draft.
  return <Conversation key={props.route.params.threadId} {...props} />;
}

function Conversation({
  route,
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'Conversation'>) {
  const { threadId } = route.params;
  const { t, rtl } = useLocale();
  const colors = useColors();
  const thread = useQuery(dziriApi.thread, { threadId });
  const me = useQuery(dziriApi.me, {});
  const messages = usePaginatedQuery(
    dziriApi.messages,
    thread && thread.encryption !== 'e2ee' ? { threadId } : 'skip',
    { initialNumItems: 30 },
  );
  const mutate = useMutation(dziriApi.sendText);
  const markRead = useMutation(dziriApi.markRead);
  const sender = useMemo(() => createTextSender(mutate, randomUUID), [mutate]);
  const { isWebSocketConnected } = useConvexConnectionState();
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  const [failed, setFailed] = useState(false);
  const visible = useRef<MessageRecord | null>(null);
  const acknowledged = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    );
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (thread) navigation.setOptions({ title: thread.title || t.unknown });
  }, [thread, navigation, t.unknown]);

  const acknowledgeVisible = useCallback(() => {
    const message = visible.current;
    if (
      !focused ||
      !active ||
      !isWebSocketConnected ||
      !message ||
      acknowledged.current === message._id
    )
      return;
    acknowledged.current = message._id;
    void markRead({ threadId, messageId: message._id }).catch(() => {
      if (acknowledged.current === message._id) acknowledged.current = null;
    });
  }, [focused, active, isWebSocketConnected, markRead, threadId]);
  useEffect(acknowledgeVisible, [acknowledgeVisible]);
  const viewability = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      visible.current =
        viewableItems
          .filter(token => token.isViewable)
          .map(token => token.item as MessageRecord)
          .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
      acknowledgeVisible();
    },
    [acknowledgeVisible],
  );
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 500,
  }).current;
  const renderMessage = useCallback(
    ({ item }: { item: MessageRecord }) => (
      <MessageBubble message={item} myId={me?._id ?? ''} peerReadAt={thread?.peerReadAt} />
    ),
    [me?._id, thread?.peerReadAt],
  );

  const send = async () => {
    if (!thread || !canSendText(thread) || !isWebSocketConnected || submitting.current) return;
    const submitted = body;
    submitting.current = true;
    setSending(true);
    setFailed(false);
    try {
      await sender.send(threadId, submitted);
      if (mounted.current) setBody(current => (current === submitted ? '' : current));
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      submitting.current = false;
      if (mounted.current) setSending(false);
    }
  };

  if (thread === undefined || me === undefined) return <Notice text={t.loading} busy />;
  if (!thread || !me) return <Notice text={t.unavailable} />;
  if (thread.encryption === 'e2ee') return <Notice text={t.encryptionUnavailable} />;
  const writable = canSendText(thread);
  const disabled =
    !writable || !isWebSocketConnected || sending || !body.trim() || body.trim().length > 8000;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      style={[tailwind.style('flex-1'), { backgroundColor: colors.background }]}>
      {thread.type === 'support' ? <SupportConnection threadId={threadId} /> : null}
      {!isWebSocketConnected ? (
        <Text
          accessibilityRole="alert"
          style={[tailwind.style('text-center py-2'), { color: colors.secondary }]}>
          {t.connection}
        </Text>
      ) : null}
      <FlashList
        data={messages.results}
        renderItem={renderMessage}
        keyExtractor={messageKey}
        inverted
        onViewableItemsChanged={viewability}
        viewabilityConfig={viewabilityConfig}
        ListEmptyComponent={
          messages.status === 'LoadingFirstPage' ? <Notice text={t.loading} busy /> : null
        }
        ListFooterComponent={
          messages.status === 'CanLoadMore' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => messages.loadMore(30)}
              style={tailwind.style('p-3')}>
              <Text style={{ color: colors.primary, textAlign: 'center' }}>{t.older}</Text>
            </Pressable>
          ) : null
        }
      />
      {failed ? (
        <Text
          accessibilityRole="alert"
          style={[tailwind.style('px-3 py-2'), { color: colors.text }]}>
          {t.sendFailed}
        </Text>
      ) : null}
      {!writable ? (
        <Text style={[tailwind.style('p-3'), { color: colors.secondary }]}>{t.readonly}</Text>
      ) : (
        <View
          style={[
            tailwind.style('border-t px-3 py-2 gap-3 items-end'),
            { borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' },
          ]}>
          <TextInput
            multiline
            maxLength={8000}
            value={body}
            onChangeText={setBody}
            placeholder={t.message}
            accessibilityLabel={t.message}
            placeholderTextColor={colors.secondary}
            editable={!sending}
            style={[
              tailwind.style('flex-1 text-base px-3 py-2 rounded-2xl'),
              {
                color: colors.text,
                backgroundColor: colors.surface,
                maxHeight: 140,
                writingDirection: 'auto',
              },
            ]}
          />
          <Pressable
            onPress={() => {
              void send();
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled, busy: sending }}
            style={[
              tailwind.style('px-3 py-[11px] rounded-[13px]'),
              { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 },
            ]}>
            <Text style={tailwind.style('text-white text-base')}>
              {sending ? t.loading : t.send}
            </Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function messageKey(message: MessageRecord) {
  return message._id;
}
