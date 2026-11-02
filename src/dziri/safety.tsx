import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  captureSafetyIntent,
  safetyDecisionCopy,
  isSafetyIntentCurrent,
  safetyIntentCommand,
  sameSafetySource,
  marketplaceSafetyPreparationCommand,
  marketplaceSafetyIntentCommand,
  marketplaceSafetyScopeKey,
  marketplaceSafetyCopy,
  type MarketplaceSafetySource,
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
  return (
    <SafetyBoundary
      key={`${props.userId}:${props.active !== false}`}
      fallback={<SafetyUnavailable {...props} />}>
      <SafetyActionContent {...props} />
    </SafetyBoundary>
  );
}
function SafetyUnavailable(props: Pick<SafetyActionProps, 'renderTrigger' | 'knownBlocked'>) {
  const { t } = useLocale(),
    colors = useColors();
  const fallback = props.renderTrigger ? (
    <SafetyTrigger
      render={props.renderTrigger}
      state={{ disabled: true, blocked: !!props.knownBlocked, open: () => {} }}
    />
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
  return fallback;
}
type SafetyActionProps = {
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
};
type MarketplaceActionProps = Pick<SafetyActionProps, 'active' | 'renderTrigger' | 'onComplete'> & {
  commerce: Omit<MarketplaceSafetySource, 'sourceKey'>;
};
export function MarketplaceSafetyAction(props: MarketplaceActionProps) {
  return (
    <SafetyBoundary
      key={`${marketplaceSafetyScopeKey(props.commerce)}:${props.active !== false}`}
      fallback={<SafetyUnavailable {...props} />}>
      <MarketplaceSafetyContent {...props} />
    </SafetyBoundary>
  );
}
function MarketplaceSafetyContent(props: MarketplaceActionProps) {
  const me = useQuery(dziriApi.me, props.active !== false ? {} : 'skip');
  if (props.active === false || !me?._id) return <SafetyUnavailable {...props} />;
  return (
    <SafetyBoundary
      key={`${me._id}:${marketplaceSafetyScopeKey(props.commerce)}`}
      fallback={<SafetyUnavailable {...props} />}>
      <MarketplaceSafetyState {...props} actorId={me._id} />
    </SafetyBoundary>
  );
}
function MarketplaceSafetyState({
  commerce,
  actorId,
  renderTrigger,
  onComplete,
}: MarketplaceActionProps & { actorId: string }) {
  const { locale } = useLocale();
  const state = useQuery(dziriApi.commerceSafetyState, commerce);
  if (!state || state.expectedActorId !== actorId)
    return <SafetyUnavailable renderTrigger={renderTrigger} />;
  return (
    <SafetyActionSession
      key={`${actorId}:${state.peerId}:${marketplaceSafetyScopeKey(commerce)}`}
      actorId={actorId}
      userId={state.peerId}
      name={state.peerName || marketplaceSafetyCopy(locale).account}
      blocked={state.blocked}
      renderTrigger={renderTrigger}
      onComplete={onComplete}
      marketplace={{ ...commerce, sourceKey: state.sourceKey }}
    />
  );
}
function SafetyTrigger({
  render,
  state,
}: {
  render: NonNullable<SafetyActionProps['renderTrigger']>;
  state: Parameters<NonNullable<SafetyActionProps['renderTrigger']>>[0];
}) {
  return <>{render(state)}</>;
}
function SafetyActionContent(props: SafetyActionProps) {
  const { active = true, userId } = props;
  const me = useQuery(dziriApi.me, active ? {} : 'skip');
  const actorId = me?._id;
  if (!active || !actorId) return <SafetyUnavailable {...props} />;
  return (
    <SafetyBoundary key={`${actorId}:${userId}`} fallback={<SafetyUnavailable {...props} />}>
      <SafetyStateAction {...props} actorId={actorId} />
    </SafetyBoundary>
  );
}
// Keep identity subscribed outside the optional endpoint's failed boundary.
function SafetyStateAction(props: SafetyActionProps & { actorId: string }) {
  const { userId, actorId } = props;
  const state = useQuery(dziriApi.blockState, { otherUserId: userId, expectedActorId: actorId });
  if (state?.expectedActorId === actorId)
    return (
      <SafetyActionSession
        key={`${actorId}:${userId}`}
        {...props}
        actorId={actorId}
        blocked={state.blocked}
      />
    );
  return <SafetyUnavailable {...props} />;
}
function SafetyActionSession({
  userId,
  name,
  renderTrigger,
  onComplete,
  actorId,
  blocked,
  marketplace,
}: SafetyActionProps & {
  actorId: string;
  blocked: boolean;
  marketplace?: MarketplaceSafetySource;
}) {
  const [owner] = useState<SafetyOwner>(() => Object.freeze({ actorId, userId }));
  const liveOwner = useRef<SafetyOwner | null>(null);
  const liveMarketplace = useRef(marketplace);
  const prepare = useMutation(dziriApi.prepareSafetyDecision);
  const prepareMarketplace = useMutation(dziriApi.prepareCommerceSafety);
  const decideMarketplace = useMutation(dziriApi.decideCommerceSafety);
  const block = useMutation(dziriApi.blockUser),
    unblock = useMutation(dziriApi.unblockUser);
  const { t, rtl, locale } = useLocale(),
    colors = useColors();
  const decisionCopy = safetyDecisionCopy(locale);
  const [intent, setIntent] = useState<SafetyIntent | null>(null),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const lock = useRef<SafetyOwner | null>(null);
  type Opening = Readonly<{
    owner: SafetyOwner;
    blocked: boolean;
    marketplace?: MarketplaceSafetySource;
  }>;
  const [opening, setOpening] = useState<Opening | null>(null),
    [preparing, setPreparing] = useState(false);
  const pending = useRef<Opening | null>(null);
  useLayoutEffect(() => {
    liveOwner.current = owner;
    return () => {
      if (liveOwner.current === owner) liveOwner.current = null;
      pending.current = null;
    };
  }, [owner]);
  useLayoutEffect(() => {
    liveMarketplace.current = marketplace;
  }, [marketplace]);
  function close() {
    if (busy) return;
    pending.current = null;
    setOpening(null);
    setPreparing(false);
    setIntent(null);
    setFailed(false);
  }
  async function open() {
    if (!owner || blocked === undefined || busy || preparing) return;
    const request = Object.freeze({
      owner,
      blocked,
      marketplace: marketplace ? Object.freeze({ ...marketplace }) : undefined,
    });
    pending.current = request;
    setOpening(request);
    setPreparing(true);
    setIntent(null);
    setFailed(false);
    try {
      const prepared = request.marketplace
        ? await prepareMarketplace(
            marketplaceSafetyPreparationCommand(owner, blocked, request.marketplace),
          )
        : await prepare({ otherUserId: owner.userId, expectedActorId: owner.actorId });
      if (pending.current !== request || liveOwner.current !== request.owner) return;
      if (!sameSafetySource(request.marketplace, liveMarketplace.current))
        throw new Error('Safety source changed');
      const captured = captureSafetyIntent(
        request.owner,
        request.blocked,
        prepared,
        request.marketplace,
      );
      if (!captured) throw new Error('Safety state changed');
      setIntent(captured);
      setOpening(null);
    } catch {
      if (pending.current === request && liveOwner.current === request.owner) setFailed(true);
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setPreparing(false);
      }
    }
  }
  const selectedBlock = intent ? intent.action === 'block' : !opening?.blocked;
  const sourceChanged = !!intent && !sameSafetySource(intent.marketplace, marketplace);
  async function confirm() {
    if (
      !intent ||
      !isSafetyIntentCurrent(intent, liveOwner.current) ||
      !sameSafetySource(intent.marketplace, liveMarketplace.current) ||
      lock.current === intent.owner
    )
      return;
    const requestOwner = intent.owner;
    lock.current = requestOwner;
    setBusy(true);
    setFailed(false);
    try {
      if (intent.marketplace) await decideMarketplace(marketplaceSafetyIntentCommand(intent));
      else if (intent.action === 'block') await block(safetyIntentCommand(intent));
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
      {renderTrigger ? (
        <SafetyTrigger
          render={renderTrigger}
          state={{
            disabled: !owner || blocked === undefined || busy || preparing,
            blocked: !!blocked,
            open: () => void open(),
          }}
        />
      ) : (
        button(
          blocked ? t.unblockAccount : t.blockAccount,
          () => void open(),
          !owner || blocked === undefined || preparing,
        )
      )}
      {isSafetyIntentCurrent(intent, owner) || !!(opening && opening.owner === owner) ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => {
            close();
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
                {selectedBlock ? t.blockAccount : t.unblockAccount}
              </Text>
              <Text style={{ fontSize: 15, color: colors.text, paddingVertical: 12 }}>{name}</Text>
              <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 19 }}>
                {marketplace
                  ? selectedBlock
                    ? marketplaceSafetyCopy(locale).block
                    : marketplaceSafetyCopy(locale).unblock
                  : selectedBlock
                    ? t.blockDescription
                    : t.unblockDescription}
              </Text>
              {failed || (sourceChanged && !busy) ? (
                <Text accessibilityRole="alert" style={{ paddingVertical: 12, color: colors.text }}>
                  {decisionCopy.failed}
                </Text>
              ) : null}
              {busy || preparing ? <ActivityIndicator color={colors.secondary} /> : null}
              <View
                style={{
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  justifyContent: 'flex-end',
                  gap: 24,
                }}>
                {button(t.cancel, close)}
                {button(
                  preparing ? decisionCopy.loading : t.confirm,
                  () => void confirm(),
                  preparing || sourceChanged || !isSafetyIntentCurrent(intent, owner),
                )}
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
