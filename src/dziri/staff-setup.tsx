import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { randomUUID, digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from './typography';
import { useLocale } from './locale';
import { Notice, useColors } from './ui';
import { FigmaButton } from './figma';
import { dziriApi } from './api';
import type { MessengerRoutes } from './routes';
import { useStaffSetup, type StaffStatusArgs } from './use-staff-setup.generated';
import {
  staffCopy,
  eligibleStaffBusinesses,
  staffWireCommand,
  type StaffBusiness,
  type StaffConfigureCommand,
  type StaffSyncCommand,
  type StaffResult,
  type StaffStatus,
} from './messenger-staff.generated';
const statusRef = makeFunctionReference<'query', StaffStatusArgs, StaffStatus | null>(
  'inbox/administration:status',
);
const configureRef = makeFunctionReference<
  'mutation',
  Omit<StaffConfigureCommand, 'kind'>,
  StaffResult
>('inbox/administration:configure');
const syncRef = makeFunctionReference<'mutation', Omit<StaffSyncCommand, 'kind'>, StaffResult>(
  'inbox/administration:synchronizeSelf',
);
function useStaffStatus(args: StaffStatusArgs | 'skip') {
  return useQuery(statusRef, args);
}
const hash = async (payload: string) =>
  'v1:' + (await digestStringAsync(CryptoDigestAlgorithm.SHA256, payload));
type Props = { actorId: string; businesses: StaffBusiness[]; supported: boolean; locale: string };
export function StaffSetupScreen({
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'StaffSetup'>) {
  const me = useQuery(dziriApi.me, {}),
    caps = useQuery(dziriApi.capabilities, {}),
    { locale } = useLocale(),
    colors = useColors(),
    copy = staffCopy(locale);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          minHeight: 52,
          paddingHorizontal: 12,
          justifyContent: 'center',
          alignItems: locale === 'ar' ? 'flex-end' : 'flex-start',
        }}>
        <FigmaButton name="back" label={copy.back} onPress={() => navigation.goBack()} />
      </View>
      {me && caps !== undefined ? (
        <StaffSetup
          actorId={me._id}
          businesses={caps?.businesses ?? []}
          supported={caps?.features?.staffSetup === 1}
          locale={locale}
        />
      ) : (
        <Notice text={copy.loading} busy />
      )}
    </View>
  );
}
export function StaffSetup(props: Props) {
  return (
    <StaffChoices
      key={props.actorId + JSON.stringify(props.businesses.map(b => [b.id, b.role]))}
      {...props}
    />
  );
}
function StaffChoices({ actorId, businesses, supported, locale }: Props) {
  const choices = eligibleStaffBusinesses(businesses),
    copy = staffCopy(locale),
    colors = useColors(),
    rtl = locale === 'ar';
  const [selected, setSelected] = useState(choices.length === 1 ? choices[0].id : '');
  const business = choices.find(b => b.id === selected);
  if (!supported || !choices.length) return <Notice text={copy.unavailable} />;
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        padding: 20,
        gap: 24,
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
      }}>
      <View style={{ gap: 8 }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 20,
            lineHeight: 30,
            fontWeight: '600',
            color: colors.text,
            textAlign: rtl ? 'right' : 'left',
          }}>
          {copy.title}
        </Text>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 22,
            color: colors.secondary,
            textAlign: rtl ? 'right' : 'left',
          }}>
          {copy.description}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, color: colors.secondary, textAlign: rtl ? 'right' : 'left' }}>
          {copy.business}
        </Text>
        {choices.map(b => (
          <Pressable
            key={b.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === b.id }}
            onPress={() => setSelected(b.id)}
            style={{
              minHeight: 44,
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: selected === b.id ? colors.text : colors.border,
              backgroundColor: colors.background,
            }}>
            <Text style={{ color: colors.text, fontSize: 14, textAlign: rtl ? 'right' : 'left' }}>
              {b.name}
            </Text>
          </Pressable>
        ))}
      </View>
      {business ? (
        <StaffCompany
          key={actorId + business.id + business.role}
          actorId={actorId}
          companyId={business.id}
          supported={supported}
          locale={locale}
        />
      ) : (
        <Text style={{ color: colors.secondary }}>{copy.choose}</Text>
      )}
    </ScrollView>
  );
}
function Action({
  text,
  onPress,
  disabled,
  secondary,
  testID,
}: {
  text: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.text,
        backgroundColor: secondary ? 'transparent' : colors.text,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}>
      <Text
        style={{
          color: secondary ? colors.text : colors.background,
          fontSize: 14,
          textAlign: 'center',
        }}>
        {text}
      </Text>
    </Pressable>
  );
}
function StaffCompany({
  actorId,
  companyId,
  locale,
  supported,
}: {
  actorId: string;
  companyId: string;
  locale: string;
  supported: boolean;
}) {
  const configure = useMutation(configureRef),
    sync = useMutation(syncRef),
    copy = staffCopy(locale),
    colors = useColors(),
    rtl = locale === 'ar',
    [stopping, setStopping] = useState<string | null>(null);
  const flow = useStaffSetup({
    actorId,
    companyId,
    locale,
    supported,
    useStatus: useStaffStatus,
    hash,
    id: randomUUID,
    send: command =>
      command.kind === 'configure'
        ? configure(staffWireCommand(command))
        : sync(staffWireCommand(command)),
  });
  const state = flow.status,
    text = {
      setup: copy.setupHint,
      stopped: copy.stopped,
      unavailable: copy.unavailable,
      loading: copy.loading,
      working: copy.working,
      ownerRequired: copy.ownerRequired,
      waiting: copy.waiting,
      link: copy.linkHint,
      linked: copy.linked,
      verify: copy.verify,
      failed: copy.failed,
      review: copy.review,
    }[flow.phase];
  return (
    <View style={{ gap: 16 }}>
      <Text
        accessibilityRole={flow.phase === 'failed' || flow.phase === 'review' ? 'alert' : 'text'}
        style={{
          color: colors.text,
          fontSize: 14,
          lineHeight: 22,
          textAlign: rtl ? 'right' : 'left',
        }}>
        {text}
      </Text>
      {flow.reviewing ? (
        <View style={{ gap: 12 }}>
          <Text
            style={{ color: colors.secondary, lineHeight: 22, textAlign: rtl ? 'right' : 'left' }}>
            {flow.reviewing === 'configure' ? copy.reviewHint : copy.linkHint}
          </Text>
          <Action
            text={flow.reviewing === 'configure' ? copy.confirmSetup : copy.link}
            disabled={
              flow.busy ||
              !state?.available ||
              (flow.reviewing === 'configure' ? !state?.canConfigure : !state?.staffContext)
            }
            onPress={() => flow.act(flow.reviewing!)}
          />
          <Action secondary text={copy.cancel} onPress={flow.cancelReview} />
        </View>
      ) : (
        <>
          {state?.canConfigure && ['setup', 'stopped'].includes(flow.phase) ? (
            <Action
              text={copy.setup}
              disabled={flow.busy || !state.available}
              onPress={() => flow.act('configure')}
            />
          ) : null}
          {flow.phase === 'link' ? (
            <Action text={copy.link} disabled={flow.busy} onPress={() => flow.act('sync')} />
          ) : null}
          {flow.phase === 'failed' && flow.retryable ? (
            <Action text={copy.retry} disabled={flow.busy} onPress={flow.retry} />
          ) : null}
          {flow.phase === 'review' ? (
            <Action text={copy.reviewAction} disabled={flow.busy} onPress={flow.review} />
          ) : null}
        </>
      )}
      {state?.canConfigure && state.enabled ? (
        <Action
          secondary
          text={copy.stop}
          disabled={flow.busy || !state.commandContext}
          onPress={() => setStopping(state.commandContext?.authorityKey ?? null)}
        />
      ) : null}
      <Modal
        visible={!!stopping}
        transparent
        animationType="fade"
        onRequestClose={() => setStopping(null)}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: 'rgba(0,0,0,.35)',
          }}>
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={() => setStopping(null)}
            style={{ padding: 20, gap: 16, borderRadius: 16, backgroundColor: colors.background }}>
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.text,
                textAlign: rtl ? 'right' : 'left',
              }}>
              {copy.stopTitle}
            </Text>
            <Text
              style={{
                color: colors.secondary,
                fontSize: 14,
                lineHeight: 22,
                textAlign: rtl ? 'right' : 'left',
              }}>
              {stopping === state?.commandContext?.authorityKey ? copy.stopHint : copy.review}
            </Text>
            <Action secondary text={copy.cancel} onPress={() => setStopping(null)} />
            <Action
              testID="confirm-staff-stop"
              text={copy.stop}
              disabled={flow.busy || stopping !== state?.commandContext?.authorityKey}
              onPress={() => {
                if (stopping === state?.commandContext?.authorityKey) flow.act('configure', false);
                setStopping(null);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
