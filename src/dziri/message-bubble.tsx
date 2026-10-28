import { messengerMetrics as metrics } from './colors';
import React, { memo, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  View,
  Text as NativeText,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from './typography';
import { useLocale } from './locale';
import { useColors } from './ui';
import type { ReactionSummary, ReplyPreview } from './api';
import type { DeliveryState } from './message-policy';
import { MessageActions } from './message-actions';
import {
  emojiOnlySize,
  messageTimeBoundary,
  messageTimeLabel,
} from './message-presentation.generated';
import { MediaPreview, type MessageMedia } from './media-preview';
import { StoryQuote } from './story-quote';
import type { StorySnapshot } from './messenger-stories.generated';
import { queuedMessageCopy } from './message-writes.generated';
import { messageDirection } from './typeface';

export interface BubbleMessage {
  reportable?: boolean;
  id: string;
  senderId: string;
  name: string;
  image?: string | null;
  body: string;
  createdAt: number;
  deleted?: boolean;
  reply?: ReplyPreview;
  story?: StorySnapshot;
  reactions: ReactionSummary[];
  status?: DeliveryState;
  local?: boolean;
  held?: boolean;
  media?: MessageMedia;
  type?: string;
  actionBody?: string;
  immutable?: boolean;
  edited?: boolean;
  pinned?: boolean;
  forwarded?: boolean;
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
  const body = reply.deleted ? t.deleted : reply.body || t.replyUnavailable;
  const direction = messageDirection(body, rtl);
  return (
    <View
      style={{
        padding: 8,
        borderStartWidth: 2,
        borderColor: outgoing ? colors.outgoingText : colors.primary,
        marginBottom: 6,
        direction,
      }}>
      <Text
        numberOfLines={1}
        style={{
          color,
          fontSize: 12,
          fontWeight: '600',
          textAlign: direction === 'rtl' ? 'right' : 'left',
        }}>
        {reply.senderName || t.unknown}
      </Text>
      <Text
        numberOfLines={2}
        style={{
          color,
          fontSize: 12,
          opacity: 0.85,
          writingDirection: direction,
          textAlign: direction === 'rtl' ? 'right' : 'left',
        }}>
        {body}
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
  review,
  actions,
  busy,
  groupedBefore = false,
  groupedAfter = false,
  previousAt,
}: {
  message: BubbleMessage;
  mine: boolean;
  selected: boolean;
  select: () => void;
  reply?: () => void;
  react?: (emoji: string) => void;
  retry?: () => void;
  review?: () => void;
  actions?: (anchorY?: number) => void;
  busy?: boolean;
  groupedBefore?: boolean;
  groupedAfter?: boolean;
  previousAt?: number;
}) {
  const { rtl, t, locale } = useLocale();
  const colors = useColors();
  const outgoingRight = mine !== rtl;
  const direction = messageDirection(message.body, rtl);
  const jumbo =
    !message.deleted &&
    !message.media &&
    !message.reply &&
    !message.story &&
    !message.pinned &&
    !message.forwarded &&
    message.type === 'text'
      ? emojiOnlySize(message.body)
      : null;
  const voice =
    message.media?.type === 'voice' &&
    !message.body &&
    !message.reply &&
    !message.story &&
    !message.pinned &&
    !message.forwarded;
  const bare = !!jumbo || voice;
  const BodyText = jumbo ? NativeText : Text;
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
    <View
      style={{
        paddingHorizontal: 12,
        paddingTop: groupedBefore ? metrics.messageJoinGap : metrics.messageGroupGap,
      }}>
      {messageTimeBoundary(message.createdAt, previousAt) ? (
        <Text
          style={{
            textAlign: 'center',
            fontSize: 11,
            lineHeight: 16,
            color: colors.secondary,
            paddingTop: 6,
            paddingBottom: 14,
          }}>
          {messageTimeLabel(message.createdAt, locale)}
        </Text>
      ) : null}
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
            style={{
              width: metrics.bubbleAvatar,
              height: metrics.bubbleAvatar,
              borderRadius: metrics.bubbleAvatar / 2,
            }}
          />
        ) : (
          <View
            style={{
              width: metrics.bubbleAvatar,
              height: metrics.bubbleAvatar,
              borderRadius: metrics.bubbleAvatar / 2,
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
              {...(Platform.OS === 'web' && actions
                ? {
                    onContextMenu: (event: {
                      preventDefault: () => void;
                      nativeEvent?: { pageY?: number };
                      clientY?: number;
                    }) => {
                      event.preventDefault();
                      actions(event.nativeEvent?.pageY ?? event.clientY);
                    },
                  }
                : {})}
              accessibilityRole="button"
              accessibilityLabel={`${t.messageActions}: ${message.body.slice(0, 100)}`}
              accessibilityHint={reply ? t.swipeReply : undefined}
              accessibilityState={{ expanded: selected }}
              onPress={() => {
                if (Date.now() - swipeAt.current > 300) select();
              }}
              onLongPress={event => {
                if (actions) {
                  swipeAt.current = Date.now();
                  actions(event.nativeEvent.pageY);
                } else select();
              }}
              style={({ pressed }) => ({
                borderRadius: metrics.bubbleRadius,
                ...(groupedBefore
                  ? outgoingRight
                    ? { borderTopRightRadius: metrics.bubbleJoinedRadius }
                    : { borderTopLeftRadius: metrics.bubbleJoinedRadius }
                  : {}),
                ...(groupedAfter
                  ? outgoingRight
                    ? { borderBottomRightRadius: metrics.bubbleJoinedRadius }
                    : { borderBottomLeftRadius: metrics.bubbleJoinedRadius }
                  : {}),
                paddingHorizontal: bare ? 0 : metrics.bubblePaddingX,
                paddingVertical: bare ? 0 : metrics.bubblePaddingY,
                backgroundColor: bare ? 'transparent' : mine ? colors.outgoing : colors.surface,
                opacity: pressed ? 0.85 : 1,
                maxWidth: '100%',
                flexShrink: 1,
              })}>
              {message.forwarded || message.pinned ? (
                <Text
                  style={{
                    fontSize: 11,
                    lineHeight: 16,
                    opacity: 0.8,
                    color: mine ? colors.outgoingText : colors.secondary,
                  }}>
                  {message.pinned ? t.pinnedMessage : t.forwarded}
                </Text>
              ) : null}
              {message.story && !message.deleted ? (
                <StoryQuote story={message.story} outgoing={mine} />
              ) : null}
              {message.reply ? <ReplyQuote reply={message.reply} outgoing={mine} /> : null}
              {message.media ? <MediaPreview media={message.media} outgoing={mine} /> : null}
              {message.body ? (
                <BodyText
                  style={{
                    ...(jumbo && Platform.OS === 'web'
                      ? {
                          fontFamily:
                            '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
                        }
                      : {}),
                    color: jumbo ? colors.text : mine ? colors.outgoingText : colors.text,
                    fontSize: jumbo || metrics.message,
                    lineHeight: jumbo ? jumbo + 10 : metrics.messageLine,
                    writingDirection: direction,
                    textAlign: direction === 'rtl' ? 'right' : 'left',
                  }}>
                  {message.body}
                </BodyText>
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
        {selected && message.status === 'failed' && !message.held ? (
          <Text accessibilityRole="alert" style={{ color: colors.secondary, fontSize: 12 }}>
            {t.deliveryInfo}
          </Text>
        ) : null}
        <MessageActions
          at={message.createdAt}
          expanded={selected}
          status={message.held ? undefined : message.status}
          info={select}
          reply={selected ? reply : undefined}
          react={selected ? react : undefined}
          retry={selected && !message.held ? retry : undefined}
          busy={busy}
          edited={message.edited}
        />
        {message.held ? (
          <View
            style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 11, color: colors.secondary }}>
              {queuedMessageCopy[locale].held}
            </Text>
            {review ? (
              <Pressable
                accessibilityRole="button"
                onPress={review}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}>
                <Text style={{ fontSize: 12, color: colors.text }}>
                  {queuedMessageCopy[locale].review}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
});
