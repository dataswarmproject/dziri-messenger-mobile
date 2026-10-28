import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, View, type ViewToken } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useIsFocused } from '@react-navigation/native';
import { useConvexConnectionState } from 'convex/react';
import { Text } from './typography';
import { useLocale } from './locale';
import { Notice, useColors } from './ui';
import { MessageBubble, type BubbleMessage } from './message-bubble';
import { MessageActionDialog } from './message-action-dialog';
import { messageActionAvailability } from './message-action-policy.generated';
import { messageGroups } from './message-groups';
import {
  useReceiptObserver,
  MarketplaceReactionObserver,
  type ExactReceiptAdapter,
} from './use-receipts';
import { ReceiptMessageBubble } from './receipt-message-bubble';
import { RECEIPT_VIEW_AREA_PERCENT, RECEIPT_READ_DWELL_MS } from './message-receipts.generated';
export function MessageList({
  messages,
  myId,
  reply,
  react,
  retry,
  review,
  read,
  delivered,
  older,
  loading,
  empty,
  edit,
  remove,
  writable = true,
  focusMessageId,
  pin,
  forward,
  reportStoreId,
  reporting = false,
  exactReceipts,
  reactionInbox = false,
}: {
  messages: BubbleMessage[];
  reportStoreId?: string;
  reporting?: boolean;
  exactReceipts?: ExactReceiptAdapter;
  reactionInbox?: boolean;
  myId: string;
  reply?: (message: BubbleMessage) => void;
  react?: (message: BubbleMessage, emoji: string) => Promise<unknown>;
  retry: (id: string) => void;
  review?: (message: BubbleMessage) => void;
  read: (ids: string[]) => Promise<unknown>;
  delivered: (ids: string[]) => Promise<unknown>;
  older?: () => void;
  loading?: boolean;
  empty?: ReactNode;
  edit?: (message: BubbleMessage, body: string) => Promise<unknown>;
  remove?: (message: BubbleMessage) => Promise<unknown>;
  writable?: boolean;
  focusMessageId?: string;
  pin?: (message: BubbleMessage) => Promise<unknown>;
  forward?: (message: BubbleMessage, complete: () => void, back: () => void) => ReactNode;
}) {
  const { t } = useLocale();
  const colors = useColors();
  const list = useRef<FlashListRef<BubbleMessage>>(null);
  const jumped = useRef<string | undefined>(undefined);
  const requested = useRef('');
  const [listReady, setListReady] = useState(false);
  useEffect(() => {
    if (!focusMessageId || jumped.current === focusMessageId || !listReady) return;
    const index = messages.findIndex(row => row.id === focusMessageId);
    if (index >= 0) {
      jumped.current = focusMessageId;
      setSelected(focusMessageId);
      void list.current?.scrollToIndex({ index, animated: false, viewPosition: 0.5 }).catch(() => {
        jumped.current = undefined;
      });
    } else if (older && !loading) {
      const request = `${focusMessageId}:${messages.length}`;
      if (requested.current !== request) {
        requested.current = request;
        older();
      }
    }
  }, [focusMessageId, messages, listReady, older, loading]);
  const focused = useIsFocused();
  const { isWebSocketConnected } = useConvexConnectionState();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [anchorY, setAnchorY] = useState<number | undefined>();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);
  const actionMessage = messages.find(message => message.id === actionId && !message.deleted);
  useEffect(() => {
    if (actionId && !actionMessage) setActionId(null);
  }, [actionId, actionMessage]);
  const enabled = focused && active && isWebSocketConnected;
  const [viewable, setViewable] = useState<Set<string>>(() => new Set());
  const observeExact = useReceiptObserver(
    exactReceipts,
    enabled,
    messages
      .filter(
        row =>
          !row.local &&
          !row.deleted &&
          row.senderId !== myId &&
          row.status === undefined &&
          row.reportable !== false,
      )
      .map(row => row.id),
  );
  const received = useRef(new Set<string>()),
    seen = useRef(new Set<string>());
  const visible = useRef<string[]>([]);
  useEffect(() => {
    if (!focused) seen.current.clear();
  }, [focused]);
  const reacting = useRef(false);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  const acknowledge = useCallback(
    (ids: string[], kind: 'read' | 'delivered') => {
      if (!enabled || exactReceipts) return;
      const known = kind === 'read' ? seen.current : received.current;
      const fresh = ids.filter(id => !known.has(id)).slice(0, 100);
      if (!fresh.length) return;
      fresh.forEach(id => known.add(id));
      void (kind === 'read' ? read(fresh) : delivered(fresh)).catch(() =>
        fresh.forEach(id => known.delete(id)),
      );
    },
    [enabled, read, delivered, exactReceipts],
  );
  useEffect(() => {
    acknowledge(
      messages.filter(m => !m.local).map(m => m.id),
      'delivered',
    );
  }, [messages, acknowledge]);
  useEffect(() => {
    acknowledge(visible.current, 'read');
  }, [acknowledge]);
  const viewability = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      visible.current = viewableItems
        .filter(item => item.isViewable && !item.item.local)
        .map(item => (item.item as BubbleMessage).id);
      observeExact(visible.current);
      setViewable(new Set(visible.current));
      acknowledge(visible.current, 'read');
    },
    [acknowledge, observeExact],
  );
  const config = useRef({
    viewAreaCoveragePercentThreshold: RECEIPT_VIEW_AREA_PERCENT,
    minimumViewTime: exactReceipts ? 0 : RECEIPT_READ_DWELL_MS,
  }).current;
  const receiptIdentity = exactReceipts?.scope
    ? JSON.stringify([
        exactReceipts.scope.actorId,
        exactReceipts.scope.threadId,
        exactReceipts.scope.epoch,
        ...(exactReceipts.scope.authorityKey ? [exactReceipts.scope.authorityKey] : []),
      ])
    : '';
  useEffect(() => {
    if (!receiptIdentity || !listReady) return;
    setViewable(new Set());
    list.current?.recomputeViewableItems();
  }, [receiptIdentity, listReady]);
  const Bubble =
    exactReceipts && exactReceipts.state !== 'inline' ? ReceiptMessageBubble : MessageBubble;
  async function toggle(message: BubbleMessage, emoji: string) {
    if (!react || reacting.current) return;
    reacting.current = true;
    setBusy(message.id);
    setFailed(false);
    try {
      await react(message, emoji);
    } catch {
      setFailed(true);
    } finally {
      reacting.current = false;
      setBusy(null);
    }
  }
  const reactionObserver =
    reactionInbox && exactReceipts?.marketplace ? (
      <MarketplaceReactionObserver
        source={exactReceipts.marketplace}
        active={enabled && (!loading || messages.length > 0)}
      />
    ) : null;
  if (!messages.length && !loading && empty && !focusMessageId)
    return (
      <>
        {reactionObserver}
        {empty}
      </>
    );
  return (
    <>
      {reactionObserver}
      {failed ? (
        <Text accessibilityRole="alert" style={{ color: colors.text, padding: 12 }}>
          {t.reactionFailed}
        </Text>
      ) : null}
      <FlashList
        ref={list}
        onLoad={() => setListReady(true)}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        data={messages}
        inverted
        keyExtractor={message => message.id}
        onViewableItemsChanged={viewability}
        viewabilityConfig={config}
        renderItem={({ item, index }) => {
          const grouped = messageGroups(messages, index);
          const available = messageActionAvailability({
            mine: item.senderId === myId,
            type: item.type ?? 'unsupported',
            body: item.actionBody,
            createdAt: item.createdAt,
            local: item.local,
            deleted: item.deleted,
            immutable: item.immutable,
            writable,
          });
          return (
            <Bubble
              receiptScope={exactReceipts?.scope}
              receiptVisible={enabled && viewable.has(item.id)}
              message={item}
              mine={item.status !== undefined || item.senderId === myId}
              selected={selected === item.id}
              select={() => setSelected(value => (value === item.id ? null : item.id))}
              reply={
                reply && !item.local && !item.deleted
                  ? () => {
                      reply(item);
                      setSelected(null);
                    }
                  : undefined
              }
              react={
                react && !item.local && !item.deleted
                  ? emoji => void toggle(item, emoji)
                  : undefined
              }
              retry={item.status === 'failed' && !item.held ? () => retry(item.id) : undefined}
              review={item.local && item.held && review ? () => review(item) : undefined}
              busy={busy === item.id}
              groupedBefore={grouped.before}
              groupedAfter={grouped.after}
              previousAt={messages[index + 1]?.createdAt}
              actions={
                (writable && !item.local && !item.deleted && (pin || forward)) ||
                (reporting &&
                  item.reportable !== false &&
                  item.senderId !== myId &&
                  !item.local &&
                  !item.deleted &&
                  !item.immutable) ||
                available.copy ||
                (available.edit && edit) ||
                (available.remove && remove) ||
                (writable && !item.local && !item.deleted && (reply || react))
                  ? y => {
                      setAnchorY(y);
                      setActionId(item.id);
                    }
                  : undefined
              }
            />
          );
        }}
        ListEmptyComponent={
          loading ? (
            <Notice text={t.loading} busy />
          ) : (
            <Text style={{ color: colors.secondary, padding: 24 }}>{t.empty}</Text>
          )
        }
        ListFooterComponent={
          older ? (
            <Pressable accessibilityRole="button" onPress={older} style={{ padding: 16 }}>
              <Text style={{ color: colors.primary, textAlign: 'center' }}>{t.older}</Text>
            </Pressable>
          ) : focusMessageId && !loading && !messages.some(row => row.id === focusMessageId) ? (
            <Text accessibilityRole="alert" style={{ padding: 16, color: colors.secondary }}>
              {t.unavailable}
            </Text>
          ) : null
        }
      />
      {actionMessage ? (
        <MessageActionDialog
          key={actionMessage.id}
          reportTarget={
            reporting &&
            actionMessage.reportable !== false &&
            actionMessage.senderId !== myId &&
            !actionMessage.local &&
            !actionMessage.immutable
              ? { messageId: actionMessage.id, storeId: reportStoreId }
              : undefined
          }
          message={actionMessage}
          myId={myId}
          writable={writable}
          edit={edit}
          remove={remove}
          close={() => setActionId(null)}
          anchorY={anchorY}
          onCopied={() => setCopied(true)}
          pin={
            pin && writable && !actionMessage.local && !actionMessage.immutable
              ? () => pin(actionMessage)
              : undefined
          }
          renderForward={
            forward &&
            writable &&
            !actionMessage.local &&
            !actionMessage.immutable &&
            actionMessage.type === 'text' &&
            actionMessage.actionBody
              ? (complete, back) => forward(actionMessage, complete, back)
              : undefined
          }
          reply={
            reply && writable
              ? () => {
                  reply(actionMessage);
                  setSelected(null);
                }
              : undefined
          }
          react={react && writable ? emoji => react(actionMessage, emoji) : undefined}
        />
      ) : null}
      {copied ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            bottom: 80,
            alignSelf: 'center',
            backgroundColor: colors.surface,
            padding: 12,
            borderRadius: 12,
            zIndex: 40,
          }}>
          <Text style={{ color: colors.text, fontSize: 13 }}>{t.messageCopied}</Text>
        </View>
      ) : null}
    </>
  );
}
