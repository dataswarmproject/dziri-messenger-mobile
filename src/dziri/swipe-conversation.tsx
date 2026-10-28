import React, { useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, Pressable, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { dziriApi } from './api';
import { FigmaIcon } from './figma';
import { useLocale } from './locale';
import { useColors } from './ui';
import { Text } from './typography';
import { ThreadActions } from './thread-actions';

export function SwipeConversation({
  threadId,
  details,
  children,
  organization,
}: {
  threadId?: string;
  details: () => void;
  children: (showActions: () => void, canOpen: () => boolean) => ReactNode;
  organization?: { pinned: boolean; archived: boolean; unread: boolean };
}) {
  const { t, rtl } = useLocale(),
    colors = useColors();
  const [open, setOpen] = useState(false),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const offset = useRef(new Animated.Value(0)).current,
    opened = useRef(false),
    swipeAt = useRef(0);
  const width = threadId ? 104 : 52;
  const detail = useQuery(dziriApi.thread, open && threadId ? { threadId } : 'skip');
  const mute = useMutation(dziriApi.muteThread);
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
    if (!threadId || !detail || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await mute({
        threadId,
        untilMs: (detail.mutedUntil ?? 0) > Date.now() ? 0 : Date.now() + 86400000,
      });
      position(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  const action = (
    icon: 'swipeMenu' | 'swipeMute',
    label: string,
    onPress: () => void,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}>
      <FigmaIcon name="swipeCircle" />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <FigmaIcon name={icon} />
      </View>
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
          gap: 8,
        }}>
        {action('swipeMenu', organization ? t.more : t.details, () => {
          position(false);
          if (organization) setMenu(true);
          else details();
        })}
        {threadId
          ? action(
              'swipeMute',
              (detail?.mutedUntil ?? 0) > Date.now() ? t.unmute : t.mute,
              () => void toggleMute(),
              !detail || busy,
            )
          : null}
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
