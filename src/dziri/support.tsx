import React, { createContext, useContext, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './typography';
import { useMutation, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dziriApi } from './api';
import type { MessengerRoutes } from './routes';
import { useLocale } from './locale';
import { Notice, useColors } from './ui';
import { tailwind } from '../theme';

const SupportTarget = createContext('');
export const SupportTargetProvider = SupportTarget.Provider;
export function useSupportCompanyId() {
  return useContext(SupportTarget);
}

export function SupportScreen(props: NativeStackScreenProps<MessengerRoutes, 'Support'>) {
  const companyId = useContext(SupportTarget);
  // Sharing consent belongs to this destination, never a previously opened link.
  return <SupportFlow key={companyId} companyId={companyId} {...props} />;
}

function SupportFlow({
  navigation,
  companyId,
}: NativeStackScreenProps<MessengerRoutes, 'Support'> & { companyId: string }) {
  const availability = useQuery(dziriApi.supportAvailability, companyId ? { companyId } : 'skip');
  const start = useMutation(dziriApi.startSupport);
  const { t } = useLocale();
  const colors = useColors();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [failed, setFailed] = useState(false);
  if (!companyId || availability === null || availability?.available === false)
    return <Notice text={t.supportUnavailable} />;
  if (availability === undefined) return <Notice text={t.loading} busy />;
  async function open() {
    if (!consent || lock.current || !availability?.available) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const result = await start({ companyId, consent: true });
      navigation.replace('Conversation', { threadId: result.threadId });
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={[tailwind.style('flex-1 p-6 gap-5'), { backgroundColor: colors.background }]}>
      <Text style={[tailwind.style('text-xl'), { color: colors.text }]}>{availability.name}</Text>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={t.supportConsent}
        accessibilityState={{ checked: consent }}
        disabled={busy}
        onPress={() => setConsent(value => !value)}
        style={tailwind.style('p-3')}>
        <Text style={{ color: colors.text }}>
          {consent ? '☑ ' : '☐ '}
          {t.supportConsent}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={!consent || busy}
        onPress={open}
        style={[
          tailwind.style('rounded-xl p-4'),
          { backgroundColor: colors.primary, opacity: consent && !busy ? 1 : 0.5 },
        ]}>
        <Text style={{ color: colors.onPrimary, textAlign: 'center' }}>
          {busy ? t.loading : t.startSupport}
        </Text>
      </Pressable>
      {failed ? (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {t.supportFailed}
        </Text>
      ) : null}
    </View>
  );
}

export function SupportConnection({ threadId }: { threadId: string }) {
  const state = useQuery(dziriApi.supportConnection, { threadId });
  const disconnect = useMutation(dziriApi.stopSharing);
  const { t } = useLocale();
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [failed, setFailed] = useState(false);
  if (!state) return null;
  async function stop() {
    if (!state?.connected || lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await disconnect({ connectionId: state.connectionId });
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View
      style={[
        tailwind.style('px-4 py-2 gap-2 border-b'),
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}>
      <Text style={{ color: colors.secondary }}>
        {state.connected ? (state.ready ? t.supportConnected : t.supportPending) : t.sharingStopped}
      </Text>
      {state.connected ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={stop}
          style={tailwind.style('py-2')}>
          <Text style={{ color: colors.primary }}>{busy ? t.loading : t.stopSharing}</Text>
        </Pressable>
      ) : null}
      {failed ? (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {t.supportFailed}
        </Text>
      ) : null}
    </View>
  );
}
