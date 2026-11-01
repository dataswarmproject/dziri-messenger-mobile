import React, { useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, Pressable, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { dziriApi } from './api';
import { IconlyGlyph, type IconlyName } from './iconly';
import { SafetyAction } from './safety';
import { DeleteChat, type DeleteChatIntent } from './delete-chat';
import { inboxActionCopy } from './inbox-actions.generated';
import { useLocale } from './locale';
import { useColors } from './ui';
import { Text } from './typography';
import { ThreadActions } from './thread-actions';

export function SwipeConversation({
  threadId,
  commerce,
  details,
  children,
  organization,
  profile,
  userId,
  title = '',
}: {
  threadId?: string;
  commerce?: { conversationId: string; storeId?: string };
  details: () => void;
  children: (showActions: () => void, canOpen: () => boolean) => ReactNode;
  organization?: { pinned: boolean; archived: boolean; unread: boolean };
  profile?: () => void;
  userId?: string;
  title?: string;
}) {
  const { t, rtl, locale } = useLocale(),
    colors = useColors();
  const copy = inboxActionCopy[locale];
  const [deleteIntent, setDeleteIntent] = useState<DeleteChatIntent | null>(null);
  const [open, setOpen] = useState(false),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const offset = useRef(new Animated.Value(0)).current,
    opened = useRef(false),
    swipeAt = useRef(0);
  const width = commerce ? 248 : threadId ? (userId ? 248 : 188) : 60;
  const detail = useQuery(dziriApi.thread, open && threadId ? { threadId } : 'skip');
  const capabilities = useQuery(dziriApi.capabilities, open || !!deleteIntent ? {} : 'skip');
  const me = useQuery(dziriApi.me, open || !!deleteIntent ? {} : 'skip');
  const commerceState = useQuery(
    dziriApi.commerceInboxState,
    open && commerce && capabilities?.features?.marketplaceMute === 1 ? commerce : 'skip',
  );
  const mute = useMutation(dziriApi.muteThread);
  const muteCommerce = useMutation(dziriApi.commerceMute);
  const muteState = commerce ? commerceState : detail;
  const muteReady = commerce
    ? !!commerceState && me?._id === commerceState.commandContext.expectedActorId
    : !!detail;
  const position = (value: boolean) => {
    opened.current = value;
    setOpen(value);
    Animated.spring(offset, {
      toValue: value ? (rtl ? width : -width) : 0,
      useNativeDriver: Platform.OS !== 'web',
      bounciness: 0,
      speed: 30,
    }).start();
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 16 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.5 &&
          (opened.current || (rtl ? g.dx > 0 : g.dx < 0)),
        onPanResponderMove: (_, g) => {
          const initial = opened.current ? (rtl ? width : -width) : 0;
          offset.setValue(
            rtl
              ? Math.max(0, Math.min(width, initial + g.dx))
              : Math.max(-width, Math.min(0, initial + g.dx)),
          );
        },
        onPanResponderRelease: (_, g) => {
          swipeAt.current = Date.now();
          const delta = rtl ? g.dx : -g.dx;
          const show = opened.current ? delta > -40 : delta > 40;
          opened.current = show;
          setOpen(show);
          Animated.spring(offset, {
            toValue: show ? (rtl ? width : -width) : 0,
            useNativeDriver: Platform.OS !== 'web',
            bounciness: 0,
            speed: 30,
          }).start();
        },
        onPanResponderTerminate: () => offset.setValue(opened.current ? (rtl ? width : -width) : 0),
      }),
    [offset, rtl, width],
  );
  async function toggleMute() {
    if (!muteReady || !muteState || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const untilMs = (muteState.mutedUntil ?? 0) > Date.now() ? 0 : Date.now() + 86400000;
      if (commerce && commerceState)
        await muteCommerce({ ...commerce, untilMs, commandContext: commerceState.commandContext });
      else if (threadId) await mute({ threadId, untilMs });
      else return;
      position(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  const action = (icon: IconlyName, label: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!open || disabled}
      accessibilityState={{ disabled: !open || disabled }}
      onPress={onPress}
      style={{
        width: 56,
        minHeight: 68,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        opacity: disabled ? 0.5 : 1,
      }}>
      <View
        pointerEvents="none"
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <IconlyGlyph name={icon} color={colors.text} size={20} />
      </View>
      <Text
        numberOfLines={2}
        style={{ color: colors.text, fontSize: 11, lineHeight: 14, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ overflow: 'hidden' }}>
      <View
        aria-hidden={!open}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: rtl ? 8 : undefined,
          right: rtl ? undefined : 8,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 4,
          pointerEvents: open ? 'auto' : 'none',
        }}>
        {threadId || commerce
          ? action(
              'volumeOff',
              (muteState?.mutedUntil ?? 0) > Date.now() ? copy.unmute : copy.mute,
              () => void toggleMute(),
              !muteReady || busy,
            )
          : null}
        {threadId || commerce
          ? action(
              'delete',
              copy.delete,
              () => {
                if (
                  !threadId ||
                  !me?._id ||
                  !detail ||
                  capabilities?.features?.historyDeletion !== 1
                )
                  return;
                setDeleteIntent({
                  threadId,
                  expectedActorId: me._id,
                  throughRevision: detail.historyRevision ?? 0,
                });
              },
              !threadId || !detail || !me || capabilities?.features?.historyDeletion !== 1,
            )
          : null}
        {action(
          'profile',
          commerce || profile ? copy.profile : t.details,
          () => {
            position(false);
            (profile ?? details)();
          },
          !!commerce && !profile,
        )}
        {commerce ? (
          action('shieldAlert', copy.block, () => {}, true)
        ) : threadId && userId ? (
          <SafetyAction
            userId={userId}
            name={title}
            active={open && capabilities?.features?.safety === 1}
            onComplete={() => position(false)}
            renderTrigger={({ blocked, disabled, open: showBlock }) =>
              action('shieldAlert', blocked ? copy.unblock : copy.block, showBlock, disabled)
            }
          />
        ) : null}
      </View>
      <Animated.View
        {...pan.panHandlers}
        style={{ transform: [{ translateX: offset }], backgroundColor: colors.background }}>
        {children(
          () => {
            swipeAt.current = Date.now();
            if (organization) setMenu(true);
            else position(!opened.current);
          },
          () => {
            if (Date.now() - swipeAt.current < 350) return false;
            if (opened.current) {
              position(false);
              return false;
            }
            return true;
          },
        )}
      </Animated.View>
      {deleteIntent ? (
        <DeleteChat
          intent={deleteIntent}
          current={
            threadId === deleteIntent.threadId &&
            capabilities?.features?.historyDeletion === 1 &&
            me?._id === deleteIntent.expectedActorId &&
            !!detail &&
            (detail.historyRevision ?? 0) === deleteIntent.throughRevision
          }
          close={() => {
            setDeleteIntent(null);
            position(false);
          }}
        />
      ) : null}
      {menu && organization && threadId ? (
        <ThreadActions
          threadId={threadId}
          {...organization}
          details={details}
          close={() => setMenu(false)}
        />
      ) : null}
      {failed ? (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: 12, color: colors.text, paddingHorizontal: 16 }}>
          {t.failed}
        </Text>
      ) : null}
    </View>
  );
}
