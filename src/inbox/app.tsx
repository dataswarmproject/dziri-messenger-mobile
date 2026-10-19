import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewToken,
} from 'react-native';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { colorsFor } from '../dziri/theme';
import {
  InboxClient,
  InboxError,
  inboxOrigin,
  mergeMessages,
  type Conversation,
  type Message,
  type Profile,
} from './client';
import { loadSession, saveSession } from './session';
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

export default function InboxApp({ onExit }: { onExit?: () => void }) {
  const { t } = useLocale();
  const [fonts, fontError] = useFonts({
    'Inter-400-20': require('../assets/fonts/Inter-400-20.ttf'),
    'Inter-600-20': require('../assets/fonts/Inter-600-20.ttf'),
  });
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
            <Connection />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Connection() {
  const [origin, setOrigin] = useState(
    process.env.EXPO_PUBLIC_INBOX_URL ?? Constants.expoConfig?.extra?.inboxUrl ?? '',
  );
  const [proxy, setProxy] = useState(false);
  const [ready, setReady] = useState(Platform.OS !== 'web');
  const [client, setClient] = useState<InboxClient | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = useRef<InboxClient | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    fetch('/runtime-config.json', { credentials: 'omit' })
      .then(response => {
        if (!response.ok) throw new Error('No local proxy');
        return response.json();
      })
      .then(config => {
        setOrigin(config.inboxUrl);
        setProxy(true);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  function create(originValue: string) {
    const localPreview = Platform.OS === 'web' && proxy;
    const normalized = inboxOrigin(originValue, __DEV__ || localPreview);
    const next = new InboxClient(normalized, fetch, localPreview ? '/inbox-api' : normalized);
    next.onSession = session => {
      void saveSession(normalized, session).catch(() =>
        setError('Session could not be saved securely.'),
      );
    };
    next.onUnauthorized = () => {
      if (current.current === next) {
        setProfile(null);
        setClient(null);
        next.dispose();
        current.current = null;
        void saveSession(normalized, null);
      }
    };
    current.current?.dispose();
    current.current = next;
    setClient(next);
    return next;
  }

  useEffect(() => {
    if (!ready || !origin) return;
    let canceled = false;
    async function restore() {
      try {
        const normalized = inboxOrigin(origin, __DEV__ || proxy);
        const stored = await loadSession(normalized);
        if (!stored || canceled) return;
        const next = create(normalized);
        next.setSession(stored);
        const me = await next.profile();
        if (!canceled) setProfile(me);
      } catch {
        if (!canceled) setError('Sign in to reconnect to Dziri Inbox.');
      }
    }
    void restore();
    return () => {
      canceled = true;
    };
    // Connection origin is locked by the local proxy or chosen at sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => () => current.current?.dispose(), []);

  async function login(email: string, password: string, mfa?: { token: string; code: string }) {
    setBusy(true);
    setError('');
    try {
      const active = mfa && client ? client : create(origin);
      const result = await active.login(
        mfa ? { mfa_token: mfa.token, otp_code: mfa.code } : { email, password },
      );
      if (result.mfa_setup_required)
        throw new Error('Complete security setup in the web dashboard before signing in.');
      if (result.mfa_required && result.mfa_token) return result.mfa_token;
      setProfile(result.data ?? null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    const active = current.current;
    if (!active) return;
    try {
      await active.signOut();
      setError('');
    } catch {
      setError(
        'Signed out on this device. Server session could not be revoked; reconnect to revoke it in web settings.',
      );
    } finally {
      active.dispose();
      current.current = null;
      setClient(null);
      setProfile(null);
      await saveSession(active.origin, null);
    }
  }
  if (!ready) return <ActivityIndicator color={colors.primary} />;
  return profile && client ? (
    <Accounts
      key={`${client.origin}:${profile.id}`}
      client={client}
      profile={profile}
      logout={logout}
    />
  ) : (
    <Login
      origin={origin}
      setOrigin={setOrigin}
      locked={proxy}
      login={login}
      busy={busy}
      error={error}
    />
  );
}

function Login({
  origin,
  setOrigin,
  locked,
  login,
  busy,
  error,
}: {
  origin: string;
  setOrigin: (url: string) => void;
  locked: boolean;
  login: (
    email: string,
    password: string,
    mfa?: { token: string; code: string },
  ) => Promise<string | undefined>;
  busy: boolean;
  error: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfa, setMfa] = useState('');
  const [code, setCode] = useState('');
  const lock = useRef(false);
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
          source={require('../../assets/dziri-ring.png')}
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
          onChangeText={setOrigin}
          editable={!locked && !mfa}
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
          </>
        ) : (
          <>
            <Text style={styles.text}>Email</Text>
            <TextInput
              accessibilityLabel="Email"
              value={email}
              onChangeText={setEmail}
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
}: {
  client: InboxClient;
  profile: Profile;
  logout: () => void;
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
      Platform.OS === 'web' ? window.location.origin : client.origin,
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
