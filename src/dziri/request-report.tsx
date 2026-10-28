import React, { Component, type ReactNode, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQuery, usePaginatedQuery } from 'convex/react';
import {
  makeFunctionReference,
  type PaginationOptions,
  type PaginationResult,
} from 'convex/server';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MessengerRoutes } from './routes';
import { dziriApi } from './api';
import { Text, TextInput } from './typography';
import { useColors } from './ui';
import { useLocale } from './locale';
import {
  safetyCopy,
  REPORT_REASONS,
  type RequestView,
  type RequestAction,
  type RequestState,
  type RequestRow,
  type ReportTarget,
  type ReportPreview,
  type ReportReason,
} from './messenger-safety.generated';
const previewRef = makeFunctionReference<'query', ReportTarget, ReportPreview>(
  'messaging/reports:preview',
);
const submitRef = makeFunctionReference<
  'mutation',
  ReportTarget & {
    expectedFingerprint: string;
    reason: ReportReason;
    notes?: string;
    consent: boolean;
  },
  { reportId: string; duplicate: boolean }
>('messaging/reports:submit');
const decideRef = makeFunctionReference<
  'mutation',
  { threadId: string; action: RequestAction },
  null
>('messaging/requests:decide');
const requestsRef = makeFunctionReference<
  'query',
  { state: RequestState; paginationOpts: PaginationOptions },
  PaginationResult<RequestRow>
>('messaging/requests:list');
function Action({
  label,
  onPress,
  disabled = false,
  selected,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  primary?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: 12,
        opacity: disabled ? 0.4 : 1,
        borderRadius: 24,
        backgroundColor: primary ? colors.primary : selected ? colors.surface : undefined,
      }}>
      <Text style={{ color: primary ? colors.onPrimary : colors.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
export function RequestBanner({ threadId, request }: { threadId: string; request?: RequestView }) {
  const { locale, rtl } = useLocale(),
    c = safetyCopy(locale),
    colors = useColors(),
    decide = useMutation(decideRef),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    lock = useRef(false);
  if (!request) return null;
  async function run(action: RequestAction) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      await decide({ threadId, action });
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ padding: 12, borderTopWidth: 1, borderColor: colors.surface }}>
      <Text style={{ fontSize: 13, color: colors.secondary, textAlign: rtl ? 'right' : 'left' }}>
        {request.role === 'recipient' ? c.received : request.canIntroduce ? c.intro : c.waiting}
      </Text>
      {request.role === 'recipient' ? (
        <View
          style={{
            flexDirection: rtl ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
          }}>
          {(request.state === 'pending'
            ? (['accept', 'decline', 'spam'] as const)
            : (['restore'] as const)
          ).map(action => (
            <Action
              key={action}
              primary={action === 'accept'}
              selected={action !== 'accept'}
              label={c[action]}
              disabled={busy}
              onPress={() => void run(action)}
            />
          ))}
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {c.failed}
        </Text>
      ) : null}
    </View>
  );
}
function ReportContent({ target, close }: { target: ReportTarget; close: () => void }) {
  const { locale, rtl } = useLocale(),
    c = safetyCopy(locale),
    colors = useColors(),
    preview = useQuery(previewRef, target),
    submit = useMutation(submitRef),
    [reason, setReason] = useState<ReportReason>('spam'),
    [notes, setNotes] = useState(''),
    [consentVersion, setConsentVersion] = useState<string | null>(null),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    lock = useRef(false);
  const consent = !!preview && consentVersion === preview.fingerprint;
  async function send() {
    if (lock.current || !preview || !consent) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      await submit({ ...target, expectedFingerprint: preview.fingerprint, reason, notes, consent });
      setSent(true);
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={{
        maxHeight: '85%',
        width: '100%',
        maxWidth: 480,
        backgroundColor: colors.background,
        borderRadius: 24,
      }}
      contentContainerStyle={{ padding: 20, gap: 12, direction: rtl ? 'rtl' : 'ltr' }}>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 20, fontWeight: '600', color: colors.text }}>
        {c.report}
      </Text>
      {preview === undefined ? (
        <Text style={{ color: colors.secondary }}>{c.loading}</Text>
      ) : sent ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
          {c.sent}
        </Text>
      ) : preview.alreadyReported ? (
        <Text style={{ color: colors.text }}>{c.existing}</Text>
      ) : (
        <>
          <Text
            style={{
              color: colors.text,
              backgroundColor: colors.surface,
              padding: 12,
              borderRadius: 12,
            }}>
            {preview.body || preview.type}
            {preview.attachmentCount ? ` · ${preview.attachmentCount}` : ''}
          </Text>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
            {REPORT_REASONS.map(r => (
              <Action
                key={r}
                label={c.reasons[r]}
                selected={r === reason}
                disabled={busy}
                onPress={() => setReason(r)}
              />
            ))}
          </View>
          <TextInput
            accessibilityLabel={c.notes}
            placeholder={c.notes}
            placeholderTextColor={colors.secondary}
            maxLength={500}
            multiline
            value={notes}
            onChangeText={setNotes}
            editable={!busy}
            style={{
              color: colors.text,
              backgroundColor: colors.surface,
              padding: 12,
              borderRadius: 12,
              minHeight: 64,
              textAlign: rtl ? 'right' : 'left',
            }}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent, disabled: busy }}
            disabled={busy}
            onPress={() => setConsentVersion(consent ? null : preview.fingerprint)}
            style={{ paddingVertical: 12 }}>
            <Text style={{ color: colors.text, fontSize: 13 }}>
              {consent ? '☑' : '□'} {c.consent}
            </Text>
          </Pressable>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.text }}>
              {c.failed}
            </Text>
          ) : null}
          <Action
            label={busy ? c.loading : c.report}
            disabled={busy || !consent}
            onPress={() => void send()}
          />
        </>
      )}
      <Action label={c.close} disabled={busy} onPress={close} />
    </ScrollView>
  );
}
export function RequestsScreen({
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'Requests'>) {
  const { locale } = useLocale(),
    c = safetyCopy(locale),
    colors = useColors(),
    caps = useQuery(dziriApi.capabilities, {});
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Action label={c.close} onPress={() => navigation.goBack()} />
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 20, fontWeight: '600' }}>
          {c.requests}
        </Text>
      </View>
      {caps === undefined ? (
        <Text style={{ color: colors.text }}>{c.loading}</Text>
      ) : caps?.features?.messageRequests === 1 ? (
        <RequestFolders
          open={id => navigation.navigate('Conversation', { threadId: id, lane: 'friends' })}
        />
      ) : (
        <Text style={{ color: colors.text }}>{c.empty}</Text>
      )}
    </View>
  );
}
function RequestFolders({ open }: { open: (id: string) => void }) {
  const { locale, rtl } = useLocale(),
    c = safetyCopy(locale),
    colors = useColors(),
    [state, setState] = useState<RequestState>('pending'),
    rows = usePaginatedQuery(requestsRef, { state }, { initialNumItems: 30 });
  return (
    <>
      <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', padding: 8 }}>
        {(['pending', 'spam', 'declined'] as const).map(s => (
          <Action key={s} label={c[s]} selected={state === s} onPress={() => setState(s)} />
        ))}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        {rows.status === 'LoadingFirstPage' ? (
          <Text style={{ color: colors.secondary }}>{c.loading}</Text>
        ) : rows.results.length === 0 ? (
          <Text style={{ color: colors.secondary }}>{c.empty}</Text>
        ) : (
          rows.results.map(row => (
            <Pressable
              accessibilityRole="button"
              key={row.threadId}
              onPress={() => open(row.threadId)}
              style={{ paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.surface }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 15,
                  fontWeight: '600',
                  textAlign: rtl ? 'right' : 'left',
                }}>
                {row.senderName || c.pending}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: colors.secondary,
                  fontSize: 13,
                  textAlign: rtl ? 'right' : 'left',
                }}>
                {row.preview}
              </Text>
            </Pressable>
          ))
        )}
        {rows.status === 'CanLoadMore' ? (
          <Action label={c.more} onPress={() => rows.loadMore(30)} />
        ) : null}
        {rows.status === 'LoadingMore' ? (
          <Text style={{ color: colors.text }}>{c.loading}</Text>
        ) : null}
      </ScrollView>
    </>
  );
}

class PrivateBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
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
export function ReportPanel(props: { target: ReportTarget; close: () => void }) {
  const { locale } = useLocale(),
    c = safetyCopy(locale),
    colors = useColors();
  return (
    <PrivateBoundary
      key={props.target.messageId}
      fallback={
        <View style={{ backgroundColor: colors.background, padding: 20, borderRadius: 24 }}>
          <Text accessibilityRole="alert" style={{ color: colors.text }}>
            {c.failed}
          </Text>
          <Action label={c.close} onPress={props.close} />
        </View>
      }>
      <ReportContent {...props} />
    </PrivateBoundary>
  );
}
