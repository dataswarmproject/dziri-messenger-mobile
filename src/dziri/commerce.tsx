import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from './typography';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
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
import { ConversationIntro } from './conversation-intro';
import { createMarketplaceReceiptAdapter } from './message-receipts.generated';
import {
  captureMarketplaceWriteScope,
  assertMarketplaceWriteScope,
  marketplaceWriteCopy,
  marketplaceWriteScopeKey,
  marketplaceDraftScope,
  queuedMessageCopy,
  ownConfirmedMessageIds,
} from './message-writes.generated';

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
  const localScope = marketplaceDraftScope(conversationId, storeId);
  const scope = useMemo(
    () => (storeId ? { conversationId, storeId } : { conversationId }),
    [conversationId, storeId],
  );
  const { t, locale } = useLocale();
  const colors = useColors();
  const me = useQuery(dziriApi.me, {});
  const detail = useQuery(dziriApi.commerceDetail, scope);
  const capabilities = useQuery(dziriApi.capabilities, {});
  const historyPages = capabilities?.features?.historyPages === 1;
  const writeActor = detail?.writeContext?.expectedActorId,
    writeAuthority = detail?.writeContext?.authorityKey;
  const writeSupported = capabilities?.features?.marketplaceWriteScope === 1;
  const writeScope = useMemo(
    () =>
      captureMarketplaceWriteScope({
        actorId: me?._id,
        conversationId,
        storeId,
        supported: writeSupported,
        context:
          writeActor && writeAuthority
            ? { expectedActorId: writeActor, authorityKey: writeAuthority }
            : null,
      }),
    [me?._id, conversationId, storeId, writeSupported, writeActor, writeAuthority],
  );
  const recentMessages = useQuery(
    dziriApi.commerceMessages,
    detail && !historyPages ? { ...scope, limit: 100 } : 'skip',
  );
  const page = usePaginatedQuery(dziriApi.commercePage, detail && historyPages ? scope : 'skip', {
    initialNumItems: 30,
  });
  const messages = useMemo(
    () => (historyPages ? page.results : (recentMessages ?? [])),
    [historyPages, page.results, recentMessages],
  );
  const send = useMutation(dziriApi.commerceSend);
  const markRead = useMutation(dziriApi.commerceRead);
  const markDelivered = useMutation(dziriApi.commerceDelivered);
  const receipts = createMarketplaceReceiptAdapter(
    {
      actorId: me?._id,
      conversationId,
      storeId,
      context: detail?.receiptContext,
    },
    (kind, payload) => (kind === 'read' ? markRead(payload) : markDelivered(payload)),
  );
  const react = useMutation(dziriApi.commerceReact);
  const editMessage = useMutation(dziriApi.commerceEdit);
  const deleteMessage = useMutation(dziriApi.commerceDelete);
  const edit = useCallback(
    (message: BubbleMessage, body: string) =>
      editMessage({ messageId: message.id, content: body, ...(storeId ? { storeId } : {}) }),
    [editMessage, storeId],
  );
  const remove = useCallback(
    (message: BubbleMessage) =>
      deleteMessage({ messageId: message.id, ...(storeId ? { storeId } : {}) }),
    [deleteMessage, storeId],
  );
  const transmit = useCallback(
    async (draft: OutgoingDraft) => {
      assertMarketplaceWriteScope(writeScope, draft.marketplaceScope);
      return send({
        ...draft.marketplaceScope!,
        content: draft.body,
        clientMessageId: draft.id,
        ...(draft.reply ? { parentMessageId: draft.reply.id } : {}),
        ...(draft.media ? { imageStorageIds: [draft.media.storageId] } : {}),
      });
    },
    [send, writeScope],
  );
  const confirmed = useMemo(
    () => ownConfirmedMessageIds(messages ?? [], me?._id),
    [messages, me?._id],
  );
  const outbox = useOutbox(transmit, confirmed, localScope, writeScope ?? undefined);
  const [reply, setReply] = useState<ReplyPreview | null>(null);
  const [queuedReview, setQueuedReview] = useState<{ owner: string; draft: OutgoingDraft } | null>(
    null,
  );
  const reviewOwner = `${me?._id ?? ''}:${localScope}`;
  const writeKey = marketplaceWriteScopeKey(writeScope);
  useEffect(() => {
    setReply(null);
    setQueuedReview(null);
  }, [writeKey]);
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
        actionBody: draft.body,
        type: draft.media?.type ?? 'text',
        createdAt: draft.createdAt,
        reply: draft.reply,
        reactions: [],
        status: draft.status,
        local: true,
        held:
          draft.status !== 'sent' &&
          (!writeScope ||
            !draft.marketplaceScope ||
            marketplaceWriteScopeKey(draft.marketplaceScope) !== writeKey),
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
        actionBody:
          message.deletedAt === undefined &&
          message.partEvent === undefined &&
          message.content !== '[Image]'
            ? message.content
            : undefined,
        type: message.imageUrls?.length && message.content === '[Image]' ? 'image' : 'text',
        immutable: message.partEvent !== undefined,
        edited: message.editedAt !== undefined,
        deleted: message.deletedAt !== undefined,
        reportable: message.moderationDecisionId === undefined,
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
        image={detail.otherImage}
        back={() => navigation.goBack()}
        details={() => navigation.navigate('Details', { conversationId, storeId })}
      />
      <MessageList
        exactReceipts={{ ...receipts, state: 'inline' }}
        reactionInbox={capabilities?.features?.reactionInbox === 1}
        reporting={capabilities?.features?.messageReporting === 1}
        reportStoreId={route.params.storeId}
        focusMessageId={route.params.focusMessageId}
        loading={
          historyPages
            ? page.status === 'LoadingFirstPage' || page.status === 'LoadingMore'
            : recentMessages === undefined
        }
        older={historyPages && page.status === 'CanLoadMore' ? () => page.loadMore(50) : undefined}
        empty={<ConversationIntro image={detail.otherImage} />}
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
        review={message => {
          const draft = outbox.drafts.find(row => row.id === message.id);
          if (draft && message.local && message.held)
            setQueuedReview({ owner: reviewOwner, draft });
        }}
        edit={edit}
        remove={remove}
        read={read}
        delivered={delivered}
      />
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
      <MessageComposer
        key={writeKey || 'unavailable'}
        draftScope={localScope}
        reply={reply}
        cancelReply={submitted =>
          setReply(current => (submitted === undefined || current === submitted ? null : current))
        }
        submit={outbox.enqueue}
        submitMedia={outbox.enqueueMedia}
        imagesOnly
        full={outbox.drafts.length >= 20}
        unavailable={!writeScope || !outbox.ready}
        review={
          queuedReview?.owner === reviewOwner &&
          !confirmed.includes(queuedReview.draft.id) &&
          outbox.drafts.some(row => row.id === queuedReview.draft.id)
            ? {
                id: queuedReview.draft.id,
                body: queuedReview.draft.body,
                attachment: queuedReview.draft.media
                  ? queuedReview.draft.media.name || queuedMessageCopy[locale].attachment
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
      />
      {!writeScope ? (
        <Text accessibilityLiveRegion="polite" style={{ padding: 8, color: colors.text }}>
          {marketplaceWriteCopy[locale]}
        </Text>
      ) : null}
    </KeyboardAvoidingView>
  );
}
