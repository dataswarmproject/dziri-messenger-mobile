import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { randomUUID, digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { useMutation, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from './typography';
import { dziriApi } from './api';
import type { MessengerRoutes } from './routes';
import { useLocale } from './locale';
import { Notice, useColors } from './ui';
import { Icon } from './icons';
import {
  supportCopy,
  captureSupportStart,
  supportStartPayload,
  supportStartConfirmed,
  validSupportPreparation,
  type SupportStartCommand,
  type SupportContext,
} from './messenger-support.generated';
const SupportTarget = createContext('');
export const SupportTargetProvider = SupportTarget.Provider;
export function useSupportCompanyId() {
  return useContext(SupportTarget);
}
type Props = NativeStackScreenProps<MessengerRoutes, 'Support'>;
export function SupportScreen(props: Props) {
  const companyId = useSupportCompanyId(),
    me = useQuery(dziriApi.me, {}),
    caps = useQuery(dziriApi.capabilities, {});
  if (!me) return null;
  return (
    <SupportFlow
      key={me._id + ':' + companyId}
      {...props}
      companyId={companyId}
      actorId={me._id}
      supported={caps?.features?.supportConsent === 1}
    />
  );
}
function SupportFlow({
  navigation,
  companyId,
  actorId,
  supported,
}: Props & { companyId: string; actorId: string; supported: boolean }) {
  const { locale, rtl } = useLocale(),
    copy = supportCopy(locale),
    colors = useColors(),
    start = useMutation(dziriApi.startSupport);
  const [accepted, setAccepted] = useState<string | null>(null),
    [pending, setPending] = useState<{ command: SupportStartCommand; hash: string } | null>(null),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const prepared = useQuery(
    dziriApi.supportAvailability,
    supported && companyId
      ? {
          companyId,
          expectedActorId: actorId,
          ...(pending
            ? {
                pendingCommand: {
                  clientCommandId: pending.command.clientCommandId,
                  payloadHash: pending.hash,
                },
              }
            : {}),
        }
      : 'skip',
  );
  const mounted = useRef(true),
    lock = useRef(false),
    attempt = useRef<SupportStartCommand | null>(null),
    current = useRef({ prepared, supported });
  current.current = { prepared, supported };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const valid = validSupportPreparation(prepared, actorId, companyId),
    key = prepared?.commandContext?.authorityKey,
    confirmed = !!pending && supportStartConfirmed(pending.command, pending.hash, prepared),
    canRetry = !!pending && valid && pending.command.commandContext.authorityKey === key;
  async function open() {
    if (lock.current || !mounted.current || !current.current.supported) return;
    const latest = current.current.prepared;
    if (pending && supportStartConfirmed(pending.command, pending.hash, latest)) {
      navigation.replace('Conversation', { threadId: latest!.confirmation!.threadId });
      return;
    }
    if (
      !validSupportPreparation(latest, actorId, companyId) ||
      (pending &&
        pending.command.commandContext.authorityKey !== latest!.commandContext!.authorityKey) ||
      (!pending && accepted !== latest!.commandContext!.authorityKey)
    )
      return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    const command =
      attempt.current ?? captureSupportStart(companyId, latest!.commandContext!, randomUUID);
    attempt.current = command;
    try {
      const hash =
        pending?.hash ??
        'v1:' +
          (
            await digestStringAsync(CryptoDigestAlgorithm.SHA256, supportStartPayload(command))
          ).toLowerCase();
      if (!mounted.current || !current.current.supported) return;
      setPending({ command, hash });
      const result = await start(command);
      if (mounted.current && current.current.supported)
        navigation.replace('Conversation', { threadId: result.threadId });
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function review() {
    attempt.current = null;
    setPending(null);
    setAccepted(null);
    setFailed(false);
  }
  if (!supported || !companyId || prepared === null || prepared?.available === false)
    return <Notice text={copy.unavailable} />;
  if (prepared === undefined) return <Notice text={copy.loading} busy />;
  const stale = !!pending && !confirmed && !canRetry;
  return (
    <View style={{ flex: 1, padding: 24, gap: 20, backgroundColor: colors.background }}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '600',
          color: colors.text,
          textAlign: rtl ? 'right' : 'left',
        }}>
        {prepared.name}
      </Text>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={copy.consent}
        accessibilityState={{ checked: valid && accepted === key, disabled: busy || !!pending }}
        disabled={busy || !!pending}
        onPress={() => setAccepted(value => (value === key ? null : (key ?? null)))}
        style={{
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          gap: 12,
          minHeight: 44,
          paddingVertical: 8,
        }}>
        <View
          style={{
            height: 22,
            width: 22,
            borderWidth: 1,
            borderColor: colors.text,
            borderRadius: 5,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {valid && accepted === key ? <Icon name="check" color={colors.text} size={18} /> : null}
        </View>
        <Text
          style={{
            flex: 1,
            color: colors.text,
            fontSize: 15,
            lineHeight: 22,
            textAlign: rtl ? 'right' : 'left',
          }}>
          {copy.consent}
        </Text>
      </Pressable>
      {stale ? (
        <Text
          accessibilityRole="text"
          style={{ color: colors.secondary, textAlign: rtl ? 'right' : 'left' }}>
          {copy.review}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={busy || (!stale && !confirmed && !canRetry && (!valid || accepted !== key))}
        onPress={stale ? review : () => void open()}
        style={{
          borderRadius: 24,
          padding: 14,
          minHeight: 48,
          backgroundColor: colors.primary,
          opacity:
            busy || (!stale && !confirmed && !canRetry && (!valid || accepted !== key)) ? 0.5 : 1,
        }}>
        <Text style={{ color: colors.onPrimary, textAlign: 'center' }}>
          {busy
            ? copy.loading
            : stale
              ? copy.start
              : confirmed
                ? copy.open
                : pending
                  ? copy.retry
                  : copy.start}
        </Text>
      </Pressable>
      {failed ? (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {copy.failed}
        </Text>
      ) : null}
    </View>
  );
}
export function SupportConnection({ threadId }: { threadId: string }) {
  const me = useQuery(dziriApi.me, {}),
    caps = useQuery(dziriApi.capabilities, {});
  if (!me || caps?.features?.supportConsent !== 1) return null;
  return <Connection key={me._id + ':' + threadId} threadId={threadId} actorId={me._id} />;
}
function Connection({ threadId, actorId }: { threadId: string; actorId: string }) {
  const state = useQuery(dziriApi.supportConnection, { threadId, expectedActorId: actorId }),
    stop = useMutation(dziriApi.stopSharing),
    { locale, rtl } = useLocale(),
    copy = supportCopy(locale),
    colors = useColors();
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    mounted = useRef(true),
    lock = useRef(false),
    current = useRef(state);
  current.current = state;
  const attempt = useRef<{
    connectionId: string;
    clientCommandId: string;
    commandContext: SupportContext;
    generation: number;
  } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (!state) return null;
  async function withdraw() {
    if (
      lock.current ||
      !current.current?.connected ||
      current.current.commandContext.expectedActorId !== actorId
    )
      return;
    const currentState = current.current,
      command =
        attempt.current?.generation === currentState.generation
          ? attempt.current
          : {
              connectionId: currentState.connectionId,
              clientCommandId: randomUUID(),
              commandContext: { ...currentState.commandContext },
              generation: currentState.generation,
            };
    attempt.current = command;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const { generation, ...args } = command;
      await stop(args);
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 4,
        borderBottomWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}>
      <Text
        accessibilityRole="text"
        style={{ color: colors.secondary, fontSize: 13, textAlign: rtl ? 'right' : 'left' }}>
        {copy[state.phase]}
      </Text>
      {state.connected ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void withdraw()}
          style={{ paddingVertical: 8, minHeight: 44 }}>
          <Text
            style={{
              color: colors.text,
              textDecorationLine: 'underline',
              textAlign: rtl ? 'right' : 'left',
            }}>
            {busy ? copy.loading : copy.stop}
          </Text>
        </Pressable>
      ) : null}
      {failed ? (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {copy.failed}
        </Text>
      ) : null}
    </View>
  );
}
