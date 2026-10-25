import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useConvexConnectionState, useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from './typography';
import { dziriApi, type ReplyPreview } from './api';
import { canSendText, messageText, deliveryState, displayMedia } from './message-policy';
import { useLocale } from './locale';
import { Notice, useColors } from './ui';
import type { MessengerRoutes } from './routes';
import { SupportConnection } from './support';
import { MessageList } from './message-list';
import { MessageComposer } from './message-composer';
import type { BubbleMessage } from './message-bubble';
import { useOutbox } from './use-outbox';
import type { OutgoingDraft } from './outbox';
import { ChatHeader } from './chat-header';

export function ConversationScreen(props: NativeStackScreenProps<MessengerRoutes, 'Conversation'>) {
  return <Conversation key={props.route.params.threadId} {...props} />;
}
function Conversation({
  route,
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'Conversation'>) {
  const { threadId } = route.params;
  const { t } = useLocale();
  const colors = useColors();
  const thread = useQuery(dziriApi.thread, { threadId });
  const me = useQuery(dziriApi.me, {});
  const messages = usePaginatedQuery(
    dziriApi.messages,
    thread && thread.encryption !== 'e2ee' ? { threadId } : 'skip',
    { initialNumItems: 30 },
  );
  const send = useMutation(dziriApi.sendText);
  const sendMedia = useMutation(dziriApi.sendMedia);
  const markRead = useMutation(dziriApi.markRead);
  const markDelivered = useMutation(dziriApi.markDelivered);
  const react = useMutation(dziriApi.toggleReaction);
  const transmit = useCallback(
    (draft: OutgoingDraft) =>
      draft.media
        ? sendMedia({
            threadId,
            clientMessageId: draft.id,
            type: draft.media.type,
            mediaStorageId: draft.media.storageId,
            mediaMime: draft.media.mime,
            mediaSizeBytes: draft.media.size,
            mediaDurationMs: draft.media.duration,
            mediaWidth: draft.media.width,
            mediaHeight: draft.media.height,
            body: draft.body || undefined,
            ...(draft.reply ? { replyToMessageId: draft.reply.id } : {}),
          })
        : send({
            threadId,
            body: draft.body,
            clientMessageId: draft.id,
            ...(draft.reply ? { replyToMessageId: draft.reply.id } : {}),
          }),
    [send, sendMedia, threadId],
  );
  const confirmed = useMemo(
    () =>
      messages.results.flatMap(message =>
        message.clientMessageId ? [message.clientMessageId] : [],
      ),
    [messages.results],
  );
  const outbox = useOutbox(transmit, confirmed);
  const [reply, setReply] = useState<ReplyPreview | null>(null);
  const { isWebSocketConnected } = useConvexConnectionState();
  useEffect(() => {
    if (thread) navigation.setOptions({ title: thread.title || t.unknown });
  }, [thread, navigation, t.unknown]);
  const newest = useCallback(
    (ids: string[]) => {
      const accepted = new Set(ids);
      return messages.results
        .filter(m => accepted.has(m._id))
        .sort((a, b) => b.createdAt - a.createdAt)[0]?._id;
    },
    [messages.results],
  );
  const read = useCallback(
    async (ids: string[]) => {
      const messageId = newest(ids);
      if (messageId) await markRead({ threadId, messageId });
    },
    [newest, markRead, threadId],
  );
  const delivered = useCallback(
    async (ids: string[]) => {
      const messageId = newest(ids);
      if (messageId) await markDelivered({ threadId, messageId });
    },
    [newest, markDelivered, threadId],
  );
  const toggle = useCallback(
    (message: BubbleMessage, emoji: string) => react({ threadId, messageId: message.id, emoji }),
    [react, threadId],
  );
  if (thread === undefined || me === undefined)
    return <Notice text={t.loading} busy onBack={() => navigation.goBack()} />;
  if (!thread || !me) return <Notice text={t.unavailable} onBack={() => navigation.goBack()} />;
  if (thread.encryption === 'e2ee')
    return <Notice text={t.encryptionUnavailable} onBack={() => navigation.goBack()} />;
  const writable = canSendText(thread);
  const rows: BubbleMessage[] = [
    ...outbox.drafts
      .filter(draft => !confirmed.includes(draft.id))
      .map(draft => ({
        id: draft.id,
        senderId: me._id,
        name: me.name || t.you,
        image: me.image,
        body: draft.body,
        createdAt: draft.createdAt,
        reply: draft.reply,
        reactions: [],
        status: draft.status,
        local: true,
        media: draft.media,
      })),
    ...messages.results.map(message => ({
      id: message._id,
      senderId: message.senderId,
      name: message.senderName || (message.senderId === me._id ? me.name || t.you : t.unknown),
      image: message.senderImage,
      body: displayMedia(message) ? (message.body ?? '') : messageText(message, t),
      media: displayMedia(message),
      createdAt: message.createdAt,
      deleted: message.deletedAt !== undefined,
      reply: message.replyPreview,
      reactions: message.reactionSummary ?? [],
      status:
        message.senderId === me._id && message.deletedAt === undefined
          ? deliveryState(
              message.createdAt,
              thread.peerReadAt,
              thread.peerDeliveredAt,
              thread.type === 'dm' ? undefined : thread.recipientReceipts,
            )
          : undefined,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatHeader
        name={thread.title || t.unknown}
        image={thread.avatarUrl}
        back={() => navigation.goBack()}
        details={() => navigation.navigate('Details', { threadId })}
      />
      {thread.type === 'support' ? <SupportConnection threadId={threadId} /> : null}
      {!isWebSocketConnected ? (
        <Text
          accessibilityRole="alert"
          style={{ padding: 8, textAlign: 'center', color: colors.secondary }}>
          {t.connection}
        </Text>
      ) : null}
      <MessageList
        messages={rows}
        myId={me._id}
        reply={
          writable
            ? message =>
                setReply({
                  id: message.id,
                  senderName: message.name,
                  body: message.body.slice(0, 240),
                  deleted: false,
                })
            : undefined
        }
        react={writable ? toggle : undefined}
        retry={outbox.retry}
        read={read}
        delivered={delivered}
        loading={messages.status === 'LoadingFirstPage'}
        older={messages.status === 'CanLoadMore' ? () => messages.loadMore(30) : undefined}
      />
      {writable ? (
        <MessageComposer
          reply={reply}
          cancelReply={() => setReply(null)}
          full={outbox.drafts.length >= 20}
          submit={outbox.enqueue}
          submitMedia={outbox.enqueueMedia}
        />
      ) : (
        <Text style={{ padding: 16, color: colors.secondary }}>{t.readonly}</Text>
      )}
    </KeyboardAvoidingView>
  );
}
