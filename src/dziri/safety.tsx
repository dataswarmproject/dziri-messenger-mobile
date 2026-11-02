import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  captureSafetyIntent,
  isSafetyIntentCurrent,
  safetyIntentCommand,
  type SafetyIntent,
  type SafetyOwner,
} from './messenger-safety.generated';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dziriApi } from './api';
import type { MessengerRoutes } from './routes';
import { Text } from './typography';
import { ScreenHeading, PersonAvatar } from './screen-parts';
import { useColors } from './ui';
import { useLocale } from './locale';
class SafetyBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function SafetyAction(props: React.ComponentProps<typeof SafetyActionContent>) {
  const { t } = useLocale(),
    colors = useColors();
  const fallback = props.renderTrigger ? (
    props.renderTrigger({ disabled: true, blocked: !!props.knownBlocked, open: () => {} })
  ) : (
    <Pressable
      disabled
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      style={{ minHeight: 44, justifyContent: 'center', opacity: 0.5 }}>
      <Text style={{ color: colors.primary, fontSize: 14 }}>
        {props.knownBlocked ? t.unblockAccount : t.blockAccount}
      </Text>
    </Pressable>
  );
  return (
    <SafetyBoundary key={`${props.userId}:${props.active !== false}`} fallback={fallback}>
      <SafetyActionContent {...props} />
    </SafetyBoundary>
  );
}
function SafetyActionContent({
  userId,
  name,
  active = true,
  renderTrigger,
  onComplete,
}: {
  userId: string;
  name: string;
  knownBlocked?: boolean;
  active?: boolean;
  renderTrigger?: (props: {
    disabled: boolean;
    blocked: boolean;
    open: () => void;
  }) => React.ReactNode;
  onComplete?: () => void;
}) {
  const me = useQuery(dziriApi.me, active ? {} : 'skip');
  const actorId = me?._id;
  const state = useQuery(
    dziriApi.blockState,
    active && actorId ? { otherUserId: userId, expectedActorId: actorId } : 'skip',
  );
  const blocked = state?.expectedActorId === actorId ? state?.blocked : undefined;
  const owner = useMemo<SafetyOwner | null>(
    () =>
      active && actorId && state?.expectedActorId === actorId
        ? Object.freeze({ actorId, userId })
        : null,
    [active, actorId, state?.expectedActorId, userId],
  );
  const liveOwner = useRef(owner);
  liveOwner.current = owner;
  const block = useMutation(dziriApi.blockUser),
    unblock = useMutation(dziriApi.unblockUser);
  const { t, rtl } = useLocale(),
    colors = useColors();
  const [intent, setIntent] = useState<SafetyIntent | null>(null),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const lock = useRef<SafetyOwner | null>(null);
  useEffect(() => {
    setIntent(null);
    setBusy(false);
    setFailed(false);
    return () => {
      if (liveOwner.current === owner) liveOwner.current = null;
    };
  }, [owner]);
  async function confirm() {
    if (
      !intent ||
      !isSafetyIntentCurrent(intent, liveOwner.current) ||
      lock.current === intent.owner
    )
      return;
    const requestOwner = intent.owner;
    lock.current = requestOwner;
    setBusy(true);
    setFailed(false);
    try {
      if (intent.action === 'block') await block(safetyIntentCommand(intent));
      else await unblock(safetyIntentCommand(intent));
      if (liveOwner.current !== requestOwner) return;
      setIntent(null);
      onComplete?.();
    } catch {
      if (liveOwner.current === requestOwner) setFailed(true);
    } finally {
      if (lock.current === requestOwner) lock.current = null;
      if (liveOwner.current === requestOwner) setBusy(false);
    }
  }
  const button = (text: string, action: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={action}
      style={{ minHeight: 44, justifyContent: 'center', opacity: busy || disabled ? 0.5 : 1 }}>
      <Text style={{ color: colors.primary, fontSize: 14 }}>{text}</Text>
    </Pressable>
  );
  return (
    <>
      {renderTrigger
        ? renderTrigger({
            disabled: !owner || blocked === undefined || busy,
            blocked: !!blocked,
            open: () => {
              if (!owner || blocked === undefined || busy) return;
              setIntent(captureSafetyIntent(owner, blocked));
              setFailed(false);
            },
          })
        : button(
            blocked ? t.unblockAccount : t.blockAccount,
            () => {
              setIntent(captureSafetyIntent(owner, blocked));
              setFailed(false);
            },
            !owner || blocked === undefined,
          )}
      {isSafetyIntentCurrent(intent, owner) ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!busy) setIntent(null);
          }}>
          <View
            accessibilityViewIsModal
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: 24,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}>
            <View
              style={{
                maxWidth: 420,
                width: '100%',
                alignSelf: 'center',
                padding: 24,
                borderRadius: 24,
                backgroundColor: colors.actionSurface,
              }}>
              <Text accessibilityRole="header" style={{ fontSize: 18, color: colors.text }}>
                {intent?.action === 'block' ? t.blockAccount : t.unblockAccount}
              </Text>
              <Text style={{ fontSize: 15, color: colors.text, paddingVertical: 12 }}>{name}</Text>
              <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 19 }}>
                {intent?.action === 'block' ? t.blockDescription : t.unblockDescription}
              </Text>
              {failed ? (
                <Text accessibilityRole="alert" style={{ paddingVertical: 12, color: colors.text }}>
                  {t.actionFailed}
                </Text>
              ) : null}
              {busy ? <ActivityIndicator color={colors.secondary} /> : null}
              <View
                style={{
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  justifyContent: 'flex-end',
                  gap: 24,
                }}>
                {button(t.cancel, () => setIntent(null))}
                {button(t.confirm, () => void confirm())}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
export function BlockedPeopleScreen({
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'BlockedPeople'>) {
  const page = usePaginatedQuery(dziriApi.blockedPage, {}, { initialNumItems: 30 });
  const colors = useColors(),
    { t, rtl } = useLocale();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}>
      <ScreenHeading title={t.blockedAccounts} back={() => navigation.goBack()} />
      {page.status === 'LoadingFirstPage' ? <ActivityIndicator color={colors.secondary} /> : null}
      {page.results.map(person => (
        <View
          key={person.userId}
          style={{
            paddingHorizontal: 16,
            minHeight: 72,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <PersonAvatar name={person.name || t.unavailable} image={person.image} size={40} />
          <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>
            {person.name || t.unavailable}
          </Text>
          <SafetyAction userId={person.userId} name={person.name || t.unavailable} knownBlocked />
        </View>
      ))}
      {!page.results.length && page.status === 'Exhausted' ? (
        <Text style={{ padding: 24, color: colors.secondary }}>{t.noBlockedAccounts}</Text>
      ) : null}
      {page.status === 'CanLoadMore' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => page.loadMore(30)}
          style={{ minHeight: 44, padding: 16 }}>
          <Text style={{ color: colors.primary }}>{t.loadMore}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
