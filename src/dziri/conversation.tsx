import { RequestBanner } from './request-report';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useConvexConnectionState, useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from './typography';
import { dziriApi, type ReplyPreview } from './api';
import { canSendText, messageText, displayMedia } from './message-policy';
import { useReceiptScope } from './use-receipts';
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
import { ConversationIntro } from './conversation-intro';
import { ForwardMessage } from './forward-message';
import { useTyping } from './use-typing';
import {
  queuedMessageCopy,
  ownConfirmedMessageIds,
  capturePersonalWriteScope,
  assertPersonalWriteScope,
  personalWriteScopeKey,
  personalWriteCopy,
} from './message-writes.generated';

export function ConversationScreen(props: NativeStackScreenProps<MessengerRoutes, 'Conversation'>) {
  return <Conversation key={props.route.params.threadId} {...props} />;
}
function Conversation({
  route,
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'Conversation'>) {
  const { threadId } = route.params;
  const localScope = `${route.params.lane ?? 'friends'}:thread:${threadId}`;
  const { t, locale } = useLocale();
  const colors = useColors();
  const thread = useQuery(dziriApi.thread, { threadId });
  const me = useQuery(dziriApi.me, {});
  const capabilities = useQuery(dziriApi.capabilities, {});
  const writeActor = thread?.writeContext?.expectedActorId,
    writeAuthority = thread?.writeContext?.authorityKey;
  const writeScope = useMemo(
    () =>
      capturePersonalWriteScope({
        actorId: me?._id,
        threadId,
        supported: capabilities?.features?.personalWriteScope === 1,
        context:
          writeActor && writeAuthority
            ? { expectedActorId: writeActor, authorityKey: writeAuthority }
            : undefined,
      }),
    [me?._id, threadId, capabilities?.features?.personalWriteScope, writeActor, writeAuthority],
  );
  const writeKey = personalWriteScopeKey(writeScope);
  const pinMessage = useMutation(dziriApi.pinMessage);
  const messages = usePaginatedQuery(
    dziriApi.messages,
    thread && thread.encryption !== 'e2ee' ? { threadId } : 'skip',
    { initialNumItems: 30 },
  );
  const send = useMutation(dziriApi.sendText);
  const sendMedia = useMutation(dziriApi.sendMedia);
  const react = useMutation(dziriApi.toggleReaction);
  const editMessage = useMutation(dziriApi.editMessage);
  const deleteMessage = useMutation(dziriApi.deleteMessage);
  const edit = useCallback(
    (message: BubbleMessage, body: string) => editMessage({ messageId: message.id, newBody: body }),
    [editMessage],
  );
  const remove = useCallback(
    (message: BubbleMessage) => deleteMessage({ messageId: message.id, scope: 'everyone' }),
    [deleteMessage],
  );
  const transmit = useCallback(
    async (draft: OutgoingDraft) => {
      assertPersonalWriteScope(writeScope, draft.personalScope);
      if (draft.sticker) throw new Error('Expression sending is unavailable');
      return draft.media
        ? sendMedia({
            ...draft.personalScope!,
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
            ...draft.personalScope!,
            body: draft.body,
            clientMessageId: draft.id,
            ...(draft.reply ? { replyToMessageId: draft.reply.id } : {}),
          });
    },
    [send, sendMedia, writeScope],
  );
  const confirmed = useMemo(
    () => ownConfirmedMessageIds(messages.results, me?._id),
    [messages.results, me?._id],
  );
  const outbox = useOutbox(transmit, confirmed, localScope, undefined, writeScope ?? undefined);
  const [reply, setReply] = useState<ReplyPreview | null>(null);
  const [queuedReview, setQueuedReview] = useState<{ owner: string; draft: OutgoingDraft } | null>(
    null,
  );
  const reviewOwner = `${me?._id ?? ''}:${localScope}`;
  useEffect(() => {
    setReply(null);
    setQueuedReview(null);
  }, [writeKey]);
  const { isWebSocketConnected } = useConvexConnectionState();
  const receipts = useReceiptScope(
    me?._id,
    threadId,
    capabilities?.features?.exactReceipts === 1 &&
      !!thread &&
      (['dm', 'group'].includes(thread.type) ||
        (thread.type === 'support' && capabilities?.features?.supportReceipts === 1)) &&
      thread.encryption !== 'e2ee' &&
      !thread.request,
    isWebSocketConnected,
  );
  const typing = useTyping(threadId, !!thread && canSendText(thread) && isWebSocketConnected);
  useEffect(() => {
    if (thread) navigation.setOptions({ title: thread.title || t.unknown });
  }, [thread, navigation, t.unknown]);
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
        actionBody: draft.body,
        type: draft.sticker ? 'sticker' : (draft.media?.type ?? 'text'),
        createdAt: draft.createdAt,
        reply: draft.reply,
        reactions: [],
        status: draft.status,
        local: true,
        held:
          draft.status !== 'sent' &&
          (!writeScope ||
            !draft.personalScope ||
            personalWriteScopeKey(draft.personalScope) !== writeKey),
        media: draft.sticker ? { type: 'sticker' as const, uri: draft.sticker.uri } : draft.media,
      })),
    ...messages.results.map(message => ({
      reportable:
        !message.ciphertext && !['blocked', 'blurred'].includes(message.moderationStatus ?? ''),
      id: message._id,
      senderId: message.senderId,
      name: message.senderName || (message.senderId === me._id ? me.name || t.you : t.unknown),
      image: message.senderImage,
      body: displayMedia(message) ? (message.body ?? '') : messageText(message, t),
      actionBody:
        !message.ciphertext &&
        message.moderationStatus !== 'blocked' &&
        message.moderationStatus !== 'blurred'
          ? message.body
          : undefined,
      type: message.type,
      edited: message.editedAt !== undefined,
      pinned: message.pinnedAt !== undefined,
      forwarded: !!message.forwardedFromMessageId,
      media: displayMedia(message),
      createdAt: message.createdAt,
      deleted: message.deletedAt !== undefined,
      reply: message.replyPreview,
      story:
        !message.ciphertext &&
        message.deletedAt === undefined &&
        !['blocked', 'blurred'].includes(message.moderationStatus ?? '')
          ? message.replyToStorySnapshot
          : undefined,
      reactions: message.reactionSummary ?? [],
      status:
        message.senderId === me._id && message.deletedAt === undefined
          ? ('sent' as const)
          : undefined,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatHeader
        subtitle={typing.people.length > 0 ? t.typingStatus : undefined}
        name={thread.title || t.unknown}
        image={thread.avatarUrl}
        back={() => navigation.goBack()}
        details={() => navigation.navigate('Details', { threadId, lane: route.params.lane })}
      />
      {thread.type === 'support' ? <SupportConnection threadId={threadId} /> : null}
      {!isWebSocketConnected ? (
        <Text
          accessibilityRole="alert"
          style={{ padding: 8, textAlign: 'center', color: colors.secondary }}>
          {t.connection}
        </Text>
      ) : null}
      {outbox.cacheFailed ? (
        <>
          <Text accessibilityRole="alert" style={{ padding: 8, color: colors.text }}>
            {t.localSaveFailed}
          </Text>
          <Text
            accessibilityRole="button"
            onPress={outbox.retryRecovery}
            style={{ padding: 12, color: colors.primary }}>
            {t.retry}
          </Text>
        </>
      ) : null}
      <MessageList
        reporting={capabilities?.features?.messageReporting === 1}
        pin={
          capabilities?.features?.inboxOrganization === 1 &&
          ['owner', 'admin', 'moderator'].includes(thread.myRole)
            ? message => pinMessage({ messageId: message.id, pinned: !message.pinned })
            : undefined
        }
        forward={
          capabilities?.features?.forwarding === 1 &&
          route.params.lane !== 'staff' &&
          ['dm', 'group'].includes(thread.type)
            ? (message, complete, back) => (
                <ForwardMessage
                  message={message}
                  threadId={threadId}
                  complete={complete}
                  back={back}
                />
              )
            : undefined
        }
        focusMessageId={route.params.focusMessageId}
        empty={<ConversationIntro image={thread.avatarUrl} />}
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
        review={message => {
          const draft = outbox.drafts.find(row => row.id === message.id);
          if (draft && message.local && message.held)
            setQueuedReview({ owner: reviewOwner, draft });
        }}
        edit={edit}
        remove={remove}
        writable={writable}
        exactReceipts={receipts}
        read={async () => null}
        delivered={async () => null}
        loading={messages.status === 'LoadingFirstPage' || messages.status === 'LoadingMore'}
        older={messages.status === 'CanLoadMore' ? () => messages.loadMore(30) : undefined}
      />
      <RequestBanner threadId={threadId} request={thread.request} />
      {writable ||
      (queuedReview?.owner === reviewOwner &&
        !confirmed.includes(queuedReview.draft.id) &&
        outbox.drafts.some(row => row.id === queuedReview.draft.id)) ? (
        <>
          <MessageComposer
            key={writeKey || 'unavailable'}
            textOnly={!!thread.request}
            onActivity={thread.request ? undefined : typing.activity}
            draftScope={localScope}
            reply={reply}
            cancelReply={submitted =>
              setReply(current =>
                submitted === undefined || current === submitted ? null : current,
              )
            }
            full={outbox.drafts.length >= 20}
            unavailable={!writable || !writeScope || !outbox.ready}
            review={
              queuedReview?.owner === reviewOwner &&
              !confirmed.includes(queuedReview.draft.id) &&
              outbox.drafts.some(row => row.id === queuedReview.draft.id)
                ? {
                    id: queuedReview.draft.id,
                    body: queuedReview.draft.body,
                    attachment: queuedReview.draft.media
                      ? queuedReview.draft.media.name || queuedMessageCopy[locale].attachment
                      : queuedReview.draft.sticker
                        ? queuedMessageCopy[locale].attachment
                        : undefined,
                  }
                : null
            }
            closeReview={() => setQueuedReview(null)}
            removeLocal={async id =>
              queuedReview?.owner === reviewOwner && queuedReview.draft.id === id
                ? outbox.discard(queuedReview.draft)
                : false
            }
            submit={outbox.enqueue}
            submitMedia={thread.request ? undefined : outbox.enqueueMedia}
            submitSticker={outbox.enqueueSticker}
          />
        </>
      ) : null}
      {!writable ? (
        <Text style={{ padding: 16, color: colors.secondary }}>{t.readonly}</Text>
      ) : null}
      {writable && !writeScope ? (
        <Text accessibilityLiveRegion="polite" style={{ padding: 8, color: colors.text }}>
          {personalWriteCopy[locale]}
        </Text>
      ) : null}
    </KeyboardAvoidingView>
  );
}
