import React, {
  Component,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, Pressable, View, useColorScheme } from 'react-native';
import { Text } from './typography';
import { consumerFonts } from './fonts';
import { consumerTypeface } from './typeface';
import { ConvexReactClient, useConvexAuth, useQuery } from 'convex/react';
import { ConvexHttpClient } from 'convex/browser';
import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { tailwind } from '../theme';
import { deploymentUrl, secureStorageKey } from './config';
import { useLocale } from './locale';
import { LanguageChoice, Notice, useColors } from './ui';
import { SignInScreen } from './auth';
import { InboxScreen } from './inbox';
import { ConversationScreen } from './conversation';
import { dziriApi } from './api';
import type { MessengerRoutes } from './routes';
import { SupportScreen, SupportTargetProvider } from './support';
import { MessengerShell } from '../shell';
import { activeMessengerTab, messengerScopeKey, type MessengerTab } from '../messenger-policy';
import { CommerceScreen } from './commerce';

const Stack = createNativeStackNavigator<MessengerRoutes>();
const ResetSession = createContext(() => {});
const TeamRuntime = createContext<(userId: string) => ReactNode>(() => null);
const previewStorage = new Map<string, string>();
const storage =
  Platform.OS === 'web'
    ? {
        getItem: (key: string) => previewStorage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          previewStorage.set(key, value);
        },
        removeItem: (key: string) => {
          previewStorage.delete(key);
        },
      }
    : {
        getItem: (key: string) => SecureStore.getItemAsync(secureStorageKey(key)),
        setItem: (key: string, value: string) =>
          SecureStore.setItemAsync(secureStorageKey(key), value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(secureStorageKey(key)),
      };

export default function DziriApp({
  renderTeam,
  supportCompanyId = '',
}: {
  renderTeam: (userId: string) => ReactNode;
  supportCompanyId?: string;
}) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SupportTargetProvider value={supportCompanyId}>
          <TeamRuntime.Provider value={renderTeam}>
            <Bootstrap />
          </TeamRuntime.Provider>
        </SupportTargetProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Bootstrap() {
  const { t } = useLocale();
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  const [fontsLoaded, fontError] = useFonts(consumerFonts);
  const url = deploymentUrl(
    process.env.EXPO_PUBLIC_CONVEX_URL ?? Constants.expoConfig?.extra?.convexUrl ?? '',
    __DEV__,
  );
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {fontError ? (
        <MessengerShell>
          <Notice text={t.failed} />
        </MessengerShell>
      ) : !fontsLoaded ? (
        <MessengerShell>
          <Notice text={t.loading} busy />
        </MessengerShell>
      ) : url ? (
        <CustomerService url={url} />
      ) : (
        <MessengerShell>
          <Notice text={`${t.config}. ${t.configHint}`} />
          <LanguageChoice />
        </MessengerShell>
      )}
    </SafeAreaView>
  );
}

function CustomerService({ url }: { url: string }) {
  const [state, setState] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [attempt, setAttempt] = useState(0);
  const { t } = useLocale();
  const colors = useColors();
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    setState('checking');
    // Read-only, anonymous probe. A disabled backend must not become an endless login spinner.
    const probe = new ConvexHttpClient(url, {
      logger: false,
      fetch: (input, init) => fetch(input, { ...init, signal: controller.signal }),
    });
    void probe
      .query(dziriApi.me, {})
      .then(() => {
        if (mounted) setState('ready');
      })
      .catch(() => {
        if (mounted) setState('unavailable');
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      mounted = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [url, attempt]);
  if (state === 'ready') return <ConnectedApp url={url} />;
  return (
    <MessengerShell>
      <Notice
        text={state === 'checking' ? t.loading : t.messengerUnavailable}
        busy={state === 'checking'}
      />
      {state === 'unavailable' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setAttempt(value => value + 1)}
          style={tailwind.style('p-4')}>
          <Text style={{ color: colors.primary, textAlign: 'center' }}>{t.retry}</Text>
        </Pressable>
      ) : null}
      <LanguageChoice />
    </MessengerShell>
  );
}

function ConnectedApp({ url }: { url: string }) {
  const [session, setSession] = useState(0);
  return <SessionRuntime key={session} url={url} reset={() => setSession(value => value + 1)} />;
}

function SessionRuntime({ url, reset }: { url: string; reset: () => void }) {
  const client = useMemo(() => new ConvexReactClient(url, { unsavedChangesWarning: false }), [url]);
  useEffect(
    () => () => {
      void client.close();
    },
    [client],
  );
  const [attempt, setAttempt] = useState(0);
  return (
    <ResetSession.Provider value={reset}>
      <ConvexAuthProvider
        client={client}
        storage={storage}
        storageNamespace={secureStorageKey(url)}>
        <MessengerBoundary
          key={attempt}
          fallback={<Recovery retry={() => setAttempt(value => value + 1)} />}>
          <AuthGate />
        </MessengerBoundary>
      </ConvexAuthProvider>
    </ResetSession.Provider>
  );
}

function AuthGate() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { t } = useLocale();
  if (isLoading)
    return (
      <MessengerShell>
        <Notice text={t.loading} busy />
      </MessengerShell>
    );
  return isAuthenticated ? (
    <UserNavigator />
  ) : (
    <MessengerShell>
      <SignInScreen />
    </MessengerShell>
  );
}

function UserNavigator() {
  const me = useQuery(dziriApi.me, {});
  const capabilities = useQuery(dziriApi.capabilities, {});
  const [selected, setSelected] = useState<MessengerTab>('friends');
  const [supportInbox, setSupportInbox] = useState<string | null>(null);
  const renderTeam = useContext(TeamRuntime);
  const { t, rtl } = useLocale();
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  // Resolve on render, so revocation cannot leave a stale tab or detail mounted.
  const tab = activeMessengerTab(selected, capabilities);
  useEffect(() => {
    if (tab !== selected) setSelected(tab);
    setSupportInbox(null);
  }, [tab, selected, capabilities]);
  if (me === undefined || capabilities === undefined)
    return (
      <MessengerShell>
        <Notice text={t.loading} busy />
      </MessengerShell>
    );
  if (!me || !capabilities)
    return (
      <MessengerShell>
        <Notice text={t.noProfile} />
        <SignOut />
      </MessengerShell>
    );
  const base = dark ? DarkTheme : DefaultTheme;
  return (
    <MessengerShell
      capabilities={capabilities}
      selected={tab}
      select={next => {
        setSelected(next);
        setSupportInbox(null);
      }}
      account={<SignOut />}>
      {tab === 'staff' && supportInbox === messengerScopeKey(me._id, tab, capabilities) ? (
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSupportInbox(null)}
            style={tailwind.style('p-3')}>
            <Text style={{ color: colors.primary }}>{t.backToTeam}</Text>
          </Pressable>
          {renderTeam(me._id)}
        </View>
      ) : (
        <NavigationContainer
          key={messengerScopeKey(me._id, tab, capabilities)}
          theme={{
            ...base,
            colors: {
              ...base.colors,
              primary: colors.primary,
              background: colors.background,
              card: colors.surface,
              text: colors.text,
              border: colors.border,
              notification: colors.primary,
            },
          }}>
          <Stack.Navigator
            screenOptions={{
              headerTintColor: colors.text,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { fontFamily: consumerTypeface({ rtl, weight: '600' }) },
              contentStyle: { backgroundColor: colors.background },
            }}>
            <Stack.Screen
              name="Chats"
              options={{
                title:
                  tab === 'friends'
                    ? t.friendsTab
                    : tab === 'customers'
                      ? t.customersTab
                      : t.teamView,
              }}>
              {props => (
                <InboxScreen
                  {...props}
                  lane={tab}
                  openSupportInbox={() =>
                    setSupportInbox(messengerScopeKey(me._id, tab, capabilities))
                  }
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="Conversation"
              component={ConversationScreen}
              options={{ title: t.unknown }}
            />
            <Stack.Screen name="Support" component={SupportScreen} options={{ title: t.support }} />
            <Stack.Screen
              name="Commerce"
              component={CommerceScreen}
              options={{ title: t.unknown }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </MessengerShell>
  );
}

function SignOut() {
  const resetSession = useContext(ResetSession);
  const { signOut } = useAuthActions();
  const { t } = useLocale();
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const exit = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await signOut();
      // A new login must never reuse a prior account's cached queries/mutation queue.
      resetSession();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={() => {
        void exit();
      }}
      style={tailwind.style('p-3')}>
      <Text style={{ color: colors.primary }}>
        {failed ? t.retry : busy ? t.loading : t.signOut}
      </Text>
    </Pressable>
  );
}

function Recovery({ retry }: { retry: () => void }) {
  const { t } = useLocale();
  const colors = useColors();
  return (
    <MessengerShell>
      <Notice text={t.failed} />
      <Pressable accessibilityRole="button" onPress={retry} style={tailwind.style('p-3')}>
        <Text style={{ color: colors.primary, textAlign: 'center' }}>{t.retry}</Text>
      </Pressable>
      <SignOut />
    </MessengerShell>
  );
}

class MessengerBoundary extends Component<
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
