import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewToken,
} from 'react-native';
import { Text, TextInput } from '../dziri/typography';
import { consumerFonts } from '../dziri/fonts';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { colorsFor } from '../dziri/theme';
import {
  type InboxClient,
  InboxError,
  inboxOrigin,
  mergeMessages,
  type Conversation,
  type Message,
  type Profile,
} from './client';
import { useStaffSession } from './use-staff-session';
import {
  staffWorkspaceKey,
  staffCopy,
  type StaffWorkspace,
} from '../dziri/messenger-staff.generated';
import { subscribeInbox } from './live';
import { staffRole } from '../access';
import { useLocale } from '../dziri/locale';

const colors = colorsFor(true);
const messageViewability = { itemVisiblePercentThreshold: 75, minimumViewTime: 500 };
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  text: { color: colors.text, fontFamily: 'Inter-400-20', fontSize: 15 },
  muted: { color: colors.secondary, fontSize: 13, fontFamily: 'Inter-400-20' },
  title: { color: colors.text, fontSize: 20, fontFamily: 'Inter-600-20' },
  input: {
    color: colors.text,
    backgroundColor: colors.surface,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 16,
    minHeight: 48,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  row: { padding: 18, gap: 7, borderBottomWidth: 1, borderColor: colors.border },
  error: { color: '#ff8ba0', padding: 12, fontSize: 14 },
});

function Action({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { opacity: disabled ? 0.5 : 1 }]}>
      <Text style={{ color: '#fff', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export default function InboxApp({
  onExit,
  workspace,
}: {
  onExit?: () => void;
  workspace: StaffWorkspace;
}) {
  const { t } = useLocale();
  const [fonts, fontError] = useFonts(consumerFonts);
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.fill}>
          <StatusBar style="light" />
          {onExit ? (
            <Pressable accessibilityRole="button" onPress={onExit} style={{ padding: 12 }}>
              <Text style={styles.text}>{t.switchView}</Text>
            </Pressable>
          ) : null}
          {fontError ? (
            <Text style={styles.error}>Unable to load fonts.</Text>
          ) : fonts ? (
            <Connection key={staffWorkspaceKey(workspace)} workspace={workspace} />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Connection({ workspace }: { workspace: StaffWorkspace }) {
  const [proxy, setProxy] = useState(false),
    [ready, setReady] = useState(Platform.OS !== 'web');
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let active = true;
    void fetch('/runtime-config.json', { credentials: 'omit' })
      .then(async response => {
        if (!response.ok) return;
        const config = await response.json();
        if (active && inboxOrigin(config.inboxUrl) === workspace.origin) setProxy(true);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [workspace.origin]);
  if (!ready) return <ActivityIndicator color={colors.primary} />;
  return <SessionConnection key={String(proxy)} workspace={workspace} proxy={proxy} />;
}
function SessionConnection({ workspace, proxy }: { workspace: StaffWorkspace; proxy: boolean }) {
  const { locale } = useLocale();
  const { client, profile, error, busy, login, logout } = useStaffSession(workspace, proxy, locale);
  return profile && client ? (
    <Accounts
      key={workspace.authorityKey}
      client={client}
      profile={profile}
      logout={logout}
      error={error}
    />
  ) : (
    <Login
      origin={workspace.origin}
      initialEmail={workspace.email}
      login={login}
      busy={busy}
      error={error}
    />
  );
}

function Login({
  origin,
  initialEmail,
  login,
  busy,
  error,
}: {
  origin: string;
  initialEmail: string;
  login: (
    email: string,
    password: string,
    mfa?: { token: string; code: string },
  ) => Promise<string | undefined>;
  busy: boolean;
  error: string;
}) {
  const email = initialEmail;
  const [password, setPassword] = useState('');
  const [mfa, setMfa] = useState('');
  const [code, setCode] = useState('');
  const lock = useRef(false);
  const { locale } = useLocale(),
    copy = staffCopy(locale);
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    try {
      const token = await login(email.trim(), password, mfa ? { token: mfa, code } : undefined);
      if (token) {
        setMfa(token);
        setPassword('');
      }
    } finally {
      lock.current = false;
    }
  }
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
      keyboardShouldPersistTaps="handled">
      <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 18 }}>
        <Image
          source={require('../../assets/dziri-ring.svg')}
          tintColor={colors.text}
          style={{ width: 76, height: 76 }}
          contentFit="contain"
        />
        <Text style={styles.title}>Dziri Inbox</Text>
        <Text style={styles.muted}>
          Your web inbox, on the go. Sign in with your staff account.
        </Text>
        <Text style={styles.text}>Inbox address</Text>
        <TextInput
          accessibilityLabel="Inbox address"
          value={origin}
          editable={false}
          autoCapitalize="none"
          keyboardType="url"
          style={styles.input}
          placeholder="https://inbox.example.com"
          placeholderTextColor={colors.secondary}
        />
        {mfa ? (
          <>
            <Text style={styles.text}>Verification code</Text>
            <TextInput
              accessibilityLabel="Verification code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              style={styles.input}
            />
            <Action
              label={copy.restartSignIn}
              disabled={busy}
              onPress={() => {
                setMfa('');
                setCode('');
                setPassword('');
              }}
            />
          </>
        ) : (
          <>
            <Text style={styles.text}>Email</Text>
            <TextInput
              accessibilityLabel="Email"
              editable={false}
              value={email}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={styles.input}
            />
            <Text style={styles.text}>Password</Text>
            <TextInput
              accessibilityLabel="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              style={styles.input}
              onSubmitEditing={submit}
            />
          </>
        )}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Action
          label={busy ? 'Signing in…' : 'Sign in'}
          onPress={submit}
          disabled={busy || !origin || (mfa ? !code : !email || !password)}
        />
      </View>
    </ScrollView>
  );
}

function Accounts({
  client,
  profile,
  logout,
  error,
}: {
  client: InboxClient;
  profile: Profile;
  logout: () => void;
  error: string;
}) {
  const available = profile.accounts.filter(account => staffRole(account) !== null);
  const [accountId, setAccountId] = useState(
    available.find(account => account.id === profile.account_id)?.id ?? available[0]?.id,
  );
  return (
    <View style={styles.fill}>
      <View style={styles.bar}>
        <Image source={require('../../assets/dziri-ring.png')} style={{ width: 32, height: 32 }} />
        <Text style={styles.title}>Dziri Inbox</Text>
        <Action label="Sign out" onPress={logout} />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ padding: 12, gap: 8 }}>
        {available.map(account => (
          <Action
            key={account.id}
            label={`${account.id === accountId ? '● ' : ''}${account.name}`}
            onPress={() => setAccountId(account.id)}
          />
        ))}
      </ScrollView>
      <Text style={[styles.muted, { paddingHorizontal: 16 }]}>
        {available.find(account => account.id === accountId)?.role === 'administrator'
          ? 'Staff · administrator'
          : 'Agent'}
      </Text>
      {accountId ? (
        <Workspace key={accountId} client={client} profile={profile} account={accountId} />
      ) : (
        <Text style={styles.error}>No active staff workspace is available.</Text>
      )}
    </View>
  );
}

function Workspace({
  client,
  profile,
  account,
}: {
  client: InboxClient;
  profile: Profile;
  account: number;
}) {
  const [online, setOnline] = useState(false);
  const [revision, setRevision] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setRevision(value => value + 1), 120);
    };
    const disconnect = subscribeInbox(
      Platform.OS === 'web' && client.proxied ? window.location.origin : client.origin,
      profile,
      account,
      refresh,
      setOnline,
    );
    const poll = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, 15000);
    const active = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      active.remove();
      disconnect();
    };
  }, [client, profile, account]);
  useEffect(() => {
    const generation = ++request.current;
    setBusy(true);
    Promise.all(
      Array.from({ length: page }, (_, index) => client.conversations(account, index + 1, status)),
    )
      .then(results => {
        if (generation !== request.current) return;
        setConversations([
          ...new Map(
            results.flatMap(result => result.data.payload).map(item => [item.id, item]),
          ).values(),
        ]);
        setMore(results[results.length - 1].data.payload.length > 0);
        setError('');
      })
      .catch(() => {
        if (generation === request.current) setError('Unable to refresh inbox.');
      })
      .finally(() => {
        if (generation === request.current) setBusy(false);
      });
    return () => {
      // This is a request generation counter, not a rendered element ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      request.current = generation + 1;
    };
  }, [client, account, status, page, revision]);
  const refresh = () => setRevision(value => value + 1);
  return (
    <View style={styles.fill}>
      <View style={[styles.bar, { paddingVertical: 8 }]}>
        <Text style={styles.muted}>
          {online ? 'Live · same inbox as web' : 'Reconnecting · refresh available'}
        </Text>
        <Action label="Refresh" onPress={refresh} />
      </View>
      {selected ? (
        <Thread
          key={selected}
          client={client}
          profile={profile}
          account={account}
          id={selected}
          revision={revision}
          changed={refresh}
          back={() => setSelected(null)}
        />
      ) : (
        <>
          <View style={styles.bar}>
            {['open', 'resolved', 'all'].map(value => (
              <Action
                key={value}
                label={`${status === value ? '● ' : ''}${value}`}
                onPress={() => {
                  setPage(1);
                  setStatus(value);
                }}
              />
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <FlatList
            data={conversations}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open conversation ${item.id}`}
                onPress={() => setSelected(item.id)}
                style={styles.row}>
                <Text style={styles.title}>
                  {item.meta.sender?.name || `Conversation #${item.id}`}
                </Text>
                <Text numberOfLines={2} style={styles.text}>
                  {item.messages?.[0]?.private
                    ? 'Private note'
                    : item.messages?.[0]?.content || 'Attachment or activity'}
                </Text>
                <Text style={styles.muted}>
                  #{item.id} · {item.status} · {item.unread_count} unread ·{' '}
                  {item.meta.assignee?.name || 'Unassigned'}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={[styles.muted, { padding: 24 }]}>
                {busy ? 'Loading conversations…' : 'No conversations in this queue.'}
              </Text>
            }
            ListFooterComponent={
              more && conversations.length ? (
                <Action
                  label={busy ? 'Loading…' : 'Load more conversations'}
                  disabled={busy}
                  onPress={() => setPage(value => value + 1)}
                />
              ) : null
            }
          />
        </>
      )}
    </View>
  );
}

function Thread({
  client,
  profile,
  account,
  id,
  revision,
  changed,
  back,
}: {
  client: InboxClient;
  profile: Profile;
  account: number;
  id: number;
  revision: number;
  changed: () => void;
  back: () => void;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [older, setOlder] = useState(true);
  const sending = useRef(false);
  const mounted = useRef(true);
  const latestRead = useRef(0);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    let canceled = false;
    Promise.all([client.conversation(account, id), client.messages(account, id)])
      .then(([detail, history]) => {
        if (canceled) return;
        setConversation(detail);
        setMessages(current => mergeMessages(current, history.payload));
        setError('');
      })
      .catch(issue => {
        if (!canceled) {
          setError(issue instanceof InboxError ? issue.message : 'Unable to load conversation.');
          setConversation(null);
          setMessages([]);
        }
      });
    return () => {
      canceled = true;
    };
  }, [client, account, id, revision]);
  async function action(work: () => Promise<unknown>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await work();
      if (mounted.current) changed();
    } catch {
      if (mounted.current) {
        setError('Change not confirmed. Refresh before retrying.');
        changed();
      }
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function send() {
    const content = draft.trim();
    if (!content || sending.current || (!note && !conversation?.can_reply)) return;
    await action(async () => {
      const message = await client.send(account, id, content, note);
      if (!mounted.current) return;
      setMessages(current => mergeMessages(current, [message]));
      setDraft(current => (current === draft ? '' : current));
    });
  }
  async function loadOlder() {
    await action(async () => {
      const history = await client.messages(account, id, messages[0]?.id);
      if (mounted.current) {
        setOlder(history.payload.length > 0);
        setMessages(current => mergeMessages(current, history.payload));
      }
    });
  }
  const latest = messages[messages.length - 1]?.id;
  const latestVisibleMessage = useRef(latest);
  useEffect(() => {
    latestVisibleMessage.current = latest;
  }, [latest]);
  const visibleMessagesChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Message>[] }) => {
      const cursor = latestVisibleMessage.current;
      if (
        !cursor ||
        latestRead.current >= cursor ||
        AppState.currentState !== 'active' ||
        (Platform.OS === 'web' && !document.hasFocus())
      )
        return;
      if (viewableItems.some(item => item.item.id === cursor)) {
        latestRead.current = cursor;
        void client.read(account, id).catch(() => {
          latestRead.current = 0;
        });
      }
    },
    [client, account, id],
  );
  return (
    <View style={styles.fill}>
      <View style={styles.bar}>
        <Action label="Back" onPress={back} />
        <Text style={styles.title}>{conversation?.meta.sender?.name || `#${id}`}</Text>
        <Text style={styles.muted}>{conversation?.status}</Text>
      </View>
      {conversation ? (
        <View style={styles.bar}>
          <Action
            label={conversation.status === 'resolved' ? 'Reopen' : 'Resolve'}
            disabled={busy}
            onPress={() =>
              action(() =>
                client.status(
                  account,
                  id,
                  conversation.status === 'resolved' ? 'open' : 'resolved',
                ),
              )
            }
          />
          <Action
            label={conversation.meta.assignee?.id === profile.id ? 'Unassign me' : 'Assign to me'}
            disabled={busy}
            onPress={() =>
              action(() =>
                client.assign(
                  account,
                  id,
                  conversation.meta.assignee?.id === profile.id ? null : profile.id,
                ),
              )
            }
          />
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <FlatList
        inverted
        data={[...messages].reverse()}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        viewabilityConfig={messageViewability}
        onViewableItemsChanged={visibleMessagesChanged}
        renderItem={({ item }) => (
          <View
            style={{
              maxWidth: '88%',
              alignSelf: item.message_type === 1 ? 'flex-end' : 'flex-start',
              gap: 5,
              padding: 14,
              borderRadius: 16,
              backgroundColor: item.private
                ? '#3a3019'
                : item.message_type === 1
                  ? colors.primary
                  : colors.surface,
            }}>
            <Text
              style={[
                styles.muted,
                { color: item.message_type === 1 && !item.private ? '#fff' : colors.secondary },
              ]}>
              {item.private ? 'Private note · ' : ''}
              {item.sender?.name || (item.message_type === 2 ? 'Activity' : 'Message')}
            </Text>
            <Text
              style={[
                styles.text,
                {
                  color: item.message_type === 1 && !item.private ? '#fff' : colors.text,
                  writingDirection: 'auto',
                },
              ]}>
              {item.content_attributes?.deleted
                ? 'Message deleted'
                : item.content ||
                  (item.attachments?.length ? 'Attachment · view in web inbox' : 'Activity')}
            </Text>
            <Text
              style={[
                styles.muted,
                { color: item.message_type === 1 && !item.private ? '#fff' : colors.secondary },
              ]}>
              {new Date(item.created_at * 1000).toLocaleTimeString()}{' '}
              {item.status ? `· ${item.status}` : ''}
            </Text>
          </View>
        )}
        ListFooterComponent={
          older && messages.length ? (
            <Action label="Load older messages" disabled={busy} onPress={loadOlder} />
          ) : null
        }
      />
      <View style={{ padding: 16, gap: 10, borderTopWidth: 1, borderColor: colors.border }}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: note }}
          accessibilityLabel="Private note"
          onPress={() => setNote(value => !value)}>
          <Text style={styles.muted}>
            {note ? '● Private note · staff only' : '○ Reply to customer'}
          </Text>
        </Pressable>
        <TextInput
          accessibilityLabel={note ? 'Private note' : 'Reply'}
          multiline
          maxLength={8000}
          value={draft}
          onChangeText={setDraft}
          placeholder={note ? 'Write a private note…' : 'Write a reply…'}
          placeholderTextColor={colors.secondary}
          style={[styles.input, { maxHeight: 120 }]}
        />
        <Action
          label={busy ? 'Saving…' : note ? 'Add private note' : 'Send reply'}
          onPress={send}
          disabled={busy || !draft.trim() || !conversation || (!note && !conversation.can_reply)}
        />
      </View>
    </View>
  );
}
