import React, { memo, useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './typography';
import { useLocale } from './locale';
import { useColors } from './ui';
import type { ReactionSummary, ReplyPreview } from './api';
import type { DeliveryState } from './message-policy';
import { MessageActions } from './message-actions';
import { MediaPreview, type MessageMedia } from './media-preview';
import { messageDirection } from './typeface';

export interface BubbleMessage {
  id: string;
  senderId: string;
  name: string;
  image?: string | null;
  body: string;
  createdAt: number;
  deleted?: boolean;
  reply?: ReplyPreview;
  reactions: ReactionSummary[];
  status?: DeliveryState;
  local?: boolean;
  media?: MessageMedia;
}
export function ReplyQuote({
  reply,
  outgoing = false,
}: {
  reply: ReplyPreview;
  outgoing?: boolean;
}) {
  const { t, rtl } = useLocale();
  const colors = useColors();
  const color = outgoing ? colors.outgoingText : colors.text;
  return (
    <View
      style={{
        padding: 8,
        borderStartWidth: 2,
        borderColor: outgoing ? colors.outgoingText : colors.primary,
        marginBottom: 6,
        direction: rtl ? 'rtl' : 'ltr',
      }}>
      <Text numberOfLines={1} style={{ color, fontSize: 12, fontWeight: '600' }}>
        {reply.senderName || t.unknown}
      </Text>
      <Text numberOfLines={2} style={{ color, fontSize: 12, opacity: 0.85 }}>
        {reply.deleted ? t.deleted : reply.body || t.replyUnavailable}
      </Text>
    </View>
  );
}
export const MessageBubble = memo(function MessageBubble({
  message,
  mine,
  selected,
  select,
  reply,
  react,
  retry,
  busy,
}: {
  message: BubbleMessage;
  mine: boolean;
  selected: boolean;
  select: () => void;
  reply?: () => void;
  react?: (emoji: string) => void;
  retry?: () => void;
  busy?: boolean;
}) {
  const { rtl, t } = useLocale();
  const colors = useColors();
  const outgoingRight = mine !== rtl;
  const direction = messageDirection(message.body, rtl);
  const shift = useRef(new Animated.Value(0)).current;
  const swipeAt = useRef(0);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !!reply && Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderMove: (_, gesture) => shift.setValue(Math.max(-60, Math.min(60, gesture.dx))),
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) >= 48 && reply) {
            swipeAt.current = Date.now();
            reply();
          }
          Animated.spring(shift, {
            toValue: 0,
            useNativeDriver: Platform.OS !== 'web',
            speed: 30,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => shift.setValue(0),
      }),
    [reply, shift],
  );
  const initials = message.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0])
    .join('');
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 3 }}>
      <Animated.View
        {...pan.panHandlers}
        style={{
          transform: [{ translateX: shift }],
          flexDirection: outgoingRight ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          gap: 6,
        }}>
        {message.image ? (
          <Image
            source={{ uri: message.image }}
            accessible={false}
            style={{ width: 28, height: 28, borderRadius: 14 }}
          />
        ) : (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: colors.secondary, fontSize: 11 }}>{initials}</Text>
          </View>
        )}
        <View
          style={{
            maxWidth: '86%',
            minWidth: 0,
            alignItems: outgoingRight ? 'flex-end' : 'flex-start',
            gap: 4,
          }}>
          <View
            style={{
              flexDirection: outgoingRight ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              maxWidth: '100%',
              gap: 3,
            }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.messageActions}: ${message.body.slice(0, 100)}`}
              accessibilityHint={reply ? t.swipeReply : undefined}
              accessibilityState={{ expanded: selected }}
              onPress={() => {
                if (Date.now() - swipeAt.current > 300) select();
              }}
              onLongPress={select}
              style={({ pressed }) => ({
                borderRadius: 18,
                paddingHorizontal: 12,
                paddingVertical: 7,
                backgroundColor: mine ? colors.outgoing : colors.surface,
                opacity: pressed ? 0.85 : 1,
                maxWidth: '100%',
                flexShrink: 1,
              })}>
              {message.reply ? <ReplyQuote reply={message.reply} outgoing={mine} /> : null}
              {message.media ? <MediaPreview media={message.media} /> : null}
              {message.body ? (
                <Text
                  selectable
                  style={{
                    color: mine ? colors.outgoingText : colors.text,
                    fontSize: 15,
                    lineHeight: 21,
                    writingDirection: direction,
                    textAlign: direction === 'rtl' ? 'right' : 'left',
                  }}>
                  {message.body}
                </Text>
              ) : null}
            </Pressable>
          </View>
          {message.reactions.length && !message.deleted ? (
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 4 }}>
              {message.reactions.map(reaction => (
                <Pressable
                  key={reaction.emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`${reaction.emoji} ${reaction.count}`}
                  accessibilityState={{ selected: reaction.mine }}
                  disabled={!react || busy}
                  onPress={() => react?.(reaction.emoji)}
                  style={{
                    minHeight: 32,
                    paddingHorizontal: 8,
                    justifyContent: 'center',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: reaction.mine ? colors.primary : colors.border,
                    backgroundColor: colors.surface,
                  }}>
                  <Text style={{ color: colors.text, fontSize: 12 }}>
                    {reaction.emoji} {reaction.count}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Animated.View>
      <View style={{ marginHorizontal: 34, alignItems: outgoingRight ? 'flex-end' : 'flex-start' }}>
        {selected && message.status === 'failed' ? (
          <Text accessibilityRole="alert" style={{ color: colors.secondary, fontSize: 12 }}>
            {t.deliveryInfo}
          </Text>
        ) : null}
        <MessageActions
          at={message.createdAt}
          expanded={selected}
          status={message.status}
          info={select}
          reply={selected ? reply : undefined}
          react={selected ? react : undefined}
          retry={selected ? retry : undefined}
          busy={busy}
        />
      </View>
    </View>
  );
});
