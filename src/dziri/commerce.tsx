import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dziriApi, type ReplyPreview, type ReactionSummary } from './api';
import type { MessengerRoutes } from './routes';
import { useLocale } from './locale';
import { Notice, useColors } from './ui';
import { useOutbox } from './use-outbox';
import type { OutgoingDraft } from './outbox';
import { MessageList } from './message-list';
import { MessageComposer } from './message-composer';
import type { BubbleMessage } from './message-bubble';
import { deliveryState } from './message-policy';
import { ChatHeader } from './chat-header';

export function CommerceScreen(props: NativeStackScreenProps<MessengerRoutes, 'Commerce'>) {
  return (
    <Commerce
      key={`${props.route.params.conversationId}:${props.route.params.storeId ?? 'buyer'}`}
      {...props}
    />
  );
}
function Commerce({ route, navigation }: NativeStackScreenProps<MessengerRoutes, 'Commerce'>) {
  const { conversationId, storeId } = route.params;
  const scope = useMemo(
    () => (storeId ? { conversationId, storeId } : { conversationId }),
    [conversationId, storeId],
  );
  const { t } = useLocale();
  const colors = useColors();
  const me = useQuery(dziriApi.me, {});
  const detail = useQuery(dziriApi.commerceDetail, scope);
  const messages = useQuery(dziriApi.commerceMessages, detail ? { ...scope, limit: 100 } : 'skip');
  const send = useMutation(dziriApi.commerceSend);
  const markRead = useMutation(dziriApi.commerceRead);
  const markDelivered = useMutation(dziriApi.commerceDelivered);
  const react = useMutation(dziriApi.commerceReact);
  const transmit = useCallback(
    (draft: OutgoingDraft) =>
      send({
        ...scope,
        content: draft.body,
        clientMessageId: draft.id,
        ...(draft.reply ? { parentMessageId: draft.reply.id } : {}),
        ...(draft.media ? { imageStorageIds: [draft.media.storageId] } : {}),
      }),
    [send, scope],
  );
  const confirmed = useMemo(
    () =>
      (messages ?? []).flatMap(message =>
        message.clientMessageId ? [message.clientMessageId] : [],
      ),
    [messages],
  );
  const outbox = useOutbox(transmit, confirmed);
  const [reply, setReply] = useState<ReplyPreview | null>(null);
  useEffect(() => {
    if (detail) navigation.setOptions({ title: detail.otherName });
  }, [detail, navigation]);
  const read = useCallback(
    (messageIds: string[]) => markRead({ ...scope, messageIds }),
    [markRead, scope],
  );
  const delivered = useCallback(
    (messageIds: string[]) => markDelivered({ ...scope, messageIds }),
    [markDelivered, scope],
  );
  const toggle = useCallback(
    (message: BubbleMessage, emoji: string) =>
      react({ messageId: message.id, emoji, ...(storeId ? { storeId } : {}) }),
    [react, storeId],
  );
  if (detail === null || me === null)
    return <Notice text={t.failed} onBack={() => navigation.goBack()} />;
  if (!detail || !me || !messages)
    return <Notice text={t.loading} busy onBack={() => navigation.goBack()} />;
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
    ...messages.map(message => {
      const reactions = new Map<string, ReactionSummary>();
      for (const reaction of message.reactions ?? []) {
        const current = reactions.get(reaction.emoji) ?? {
          emoji: reaction.emoji,
          count: 0,
          mine: false,
        };
        current.count++;
        current.mine ||= reaction.userId === me._id;
        reactions.set(reaction.emoji, current);
      }
      return {
        id: message._id,
        senderId: message.senderId,
        name: message.senderName,
        image: message.senderImage,
        body:
          message.deletedAt !== undefined
            ? t.deleted
            : message.imageUrls?.length && message.content === '[Image]'
              ? ''
              : message.content,
        media:
          message.deletedAt === undefined && message.imageUrls?.[0]
            ? { type: 'image' as const, uri: message.imageUrls[0] }
            : undefined,
        createdAt: message.createdAt,
        deleted: message.deletedAt !== undefined,
        reactions: [...reactions.values()],
        reply: message.parentMessageId
          ? {
              id: message.parentMessageId,
              senderName: message.parentSenderName,
              body: message.parentContent ?? undefined,
              deleted: message.parentDeleted ?? false,
            }
          : undefined,
        status:
          message.senderSide === detail.viewerSide && message.deletedAt === undefined
            ? deliveryState(message.createdAt, message.receiptReadAt, message.deliveredAt)
            : undefined,
      };
    }),
  ].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ChatHeader
        name={detail.otherName}
        back={() => navigation.goBack()}
        details={() => navigation.navigate('Details', { conversationId, storeId })}
      />
      <MessageList
        messages={rows}
        myId={me._id}
        reply={message =>
          setReply({
            id: message.id,
            senderName: message.name,
            body: message.body.slice(0, 240),
            deleted: false,
          })
        }
        react={toggle}
        retry={outbox.retry}
        read={read}
        delivered={delivered}
      />
      <MessageComposer
        reply={reply}
        cancelReply={() => setReply(null)}
        submit={outbox.enqueue}
        submitMedia={outbox.enqueueMedia}
        imagesOnly
        full={outbox.drafts.length >= 20}
      />
    </KeyboardAvoidingView>
  );
}
