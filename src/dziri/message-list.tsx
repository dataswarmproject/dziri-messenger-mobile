import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, type ViewToken } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useIsFocused } from '@react-navigation/native';
import { useConvexConnectionState } from 'convex/react';
import { Text } from './typography';
import { useLocale } from './locale';
import { Notice, useColors } from './ui';
import { MessageBubble, type BubbleMessage } from './message-bubble';
export function MessageList({
  messages,
  myId,
  reply,
  react,
  retry,
  read,
  delivered,
  older,
  loading,
}: {
  messages: BubbleMessage[];
  myId: string;
  reply?: (message: BubbleMessage) => void;
  react?: (message: BubbleMessage, emoji: string) => Promise<unknown>;
  retry: (id: string) => void;
  read: (ids: string[]) => Promise<unknown>;
  delivered: (ids: string[]) => Promise<unknown>;
  older?: () => void;
  loading?: boolean;
}) {
  const { t } = useLocale();
  const colors = useColors();
  const focused = useIsFocused();
  const { isWebSocketConnected } = useConvexConnectionState();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const enabled = focused && active && isWebSocketConnected;
  const received = useRef(new Set<string>()),
    seen = useRef(new Set<string>());
  const visible = useRef<string[]>([]);
  const reacting = useRef(false);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  const acknowledge = useCallback(
    (ids: string[], kind: 'read' | 'delivered') => {
      if (!enabled) return;
      const known = kind === 'read' ? seen.current : received.current;
      const fresh = ids.filter(id => !known.has(id)).slice(0, 100);
      if (!fresh.length) return;
      fresh.forEach(id => known.add(id));
      void (kind === 'read' ? read(fresh) : delivered(fresh)).catch(() =>
        fresh.forEach(id => known.delete(id)),
      );
    },
    [enabled, read, delivered],
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
      acknowledge(visible.current, 'read');
    },
    [acknowledge],
  );
  const config = useRef({ itemVisiblePercentThreshold: 80, minimumViewTime: 500 }).current;
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
  return (
    <>
      {failed ? (
        <Text accessibilityRole="alert" style={{ color: colors.text, padding: 12 }}>
          {t.reactionFailed}
        </Text>
      ) : null}
      <FlashList
        data={messages}
        inverted
        keyExtractor={message => message.id}
        onViewableItemsChanged={viewability}
        viewabilityConfig={config}
        renderItem={({ item }) => (
          <MessageBubble
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
              react && !item.local && !item.deleted ? emoji => void toggle(item, emoji) : undefined
            }
            retry={item.status === 'failed' ? () => retry(item.id) : undefined}
            busy={busy === item.id}
          />
        )}
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
          ) : null
        }
      />
    </>
  );
}
