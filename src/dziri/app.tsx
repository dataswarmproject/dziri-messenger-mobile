import { RequestsScreen } from './request-report';
import React, {
  Component,
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from './typography';
import { consumerFonts } from './fonts';
import { consumerTypeface } from './typeface';
import { ConvexReactClient, useConvex, useConvexAuth, useQuery } from 'convex/react';
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
import { deploymentUrl, secureStorageKey, MAIN_DZIRI_CONVEX_URL } from './config';
import { useLocale } from './locale';
import { Notice, useColors } from './ui';
import { SignInScreen, SignUpCompletion } from './auth';
import { InboxScreen } from './inbox';
import { ConversationScreen } from './conversation';
import { dziriApi } from './api';
import type { MessengerRoutes } from './routes';
import { SupportScreen, SupportTargetProvider } from './support';
import { MessengerShell } from '../shell';
import { activeMessengerTab, messengerScopeKey, type MessengerTab } from '../messenger-policy';
import { CommerceScreen } from './commerce';
import { IconButton } from './icons';
import { usePersonalPush } from './use-personal-push';
import { SettingsIcon } from './settings-icon';
import { useAppearance } from './appearance';
import { SettingsScreen, PrivacyScreen, ProfileSettingsScreen } from './settings';
import { PeopleScreen } from './people';
import { DetailsScreen } from './details';
import { usePresenceHeartbeat } from './use-presence';
import { StoreProfileScreen, ProfileScreen } from './directory-profile';
import { createWebSessionStorage } from './session-storage';
import { messengerWorkspace } from './workspace-layout';
import { WorkspaceSidebar, type WorkspaceSelection } from './workspace-sidebar';
import { BlockedPeopleScreen } from './safety';
import { LocalMessagesProvider, clearLocalMessageSessions } from './local-messages';
import { StartupScreen } from './startup-screen';
import { StaffSetupScreen } from './staff-setup';

const Stack = createNativeStackNavigator<MessengerRoutes>();
const ResetSession = createContext(() => {});
const TeamRuntime = createContext<(userId: string) => ReactNode>(() => null);
const storage =
  Platform.OS === 'web'
    ? createWebSessionStorage(() => window.sessionStorage)
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
  const { dark } = useAppearance();
  const [fontsLoaded, fontError] = useFonts(consumerFonts);
  const url = deploymentUrl(
    process.env.EXPO_PUBLIC_CONVEX_URL ??
      Constants.expoConfig?.extra?.convexUrl ??
      MAIN_DZIRI_CONVEX_URL,
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
        <StartupScreen />
      ) : url ? (
        <CustomerService url={url} />
      ) : (
        <MessengerShell>
          <Notice text={`${t.config}. ${t.configHint}`} />
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
  if (state === 'checking') return <StartupScreen />;
  return (
    <MessengerShell>
      <Notice text={t.messengerUnavailable} />
      {state === 'unavailable' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setAttempt(value => value + 1)}
          style={tailwind.style('p-4')}>
          <Text style={{ color: colors.primary, textAlign: 'center' }}>{t.retry}</Text>
        </Pressable>
      ) : null}
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
  const [registrationPending, setRegistrationPending] = useState(false);
  const { signOut } = useAuthActions();
  const resetSession = useContext(ResetSession);
  const completeRegistration = useCallback(() => setRegistrationPending(false), []);
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) return <StartupScreen />;
  return isAuthenticated && registrationPending ? (
    <MessengerShell>
      <SignUpCompletion
        complete={completeRegistration}
        cancel={() => signOut().then(resetSession)}
      />
    </MessengerShell>
  ) : isAuthenticated ? (
    <UserNavigator />
  ) : (
    <MessengerShell>
      <SignInScreen registrationPending={setRegistrationPending} />
    </MessengerShell>
  );
}

function UserNavigator() {
  const { width } = useWindowDimensions();
  const [workspaceRoute, setWorkspaceRoute] = useState<{
    scope: string;
    selection: WorkspaceSelection;
  } | null>(null);
  const client = useConvex();
  const me = useQuery(dziriApi.me, {});
  usePersonalPush(me?._id);
  usePresenceHeartbeat(!!me);
  const capabilities = useQuery(dziriApi.capabilities, {});
  const [selected, setSelected] = useState<MessengerTab>('friends');
  const [supportInbox, setSupportInbox] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const renderTeam = useContext(TeamRuntime);
  const { t, rtl } = useLocale();
  const colors = useColors();
  const { dark } = useAppearance();
  // Resolve on render, so revocation cannot leave a stale tab or detail mounted.
  const tab = activeMessengerTab(selected, capabilities);
  useEffect(() => {
    if (tab !== selected) setSelected(tab);
    setSupportInbox(null);
  }, [tab, selected, capabilities]);
  if (me === undefined || capabilities === undefined) return <StartupScreen />;
  if (!me || !capabilities)
    return (
      <MessengerShell>
        <Notice text={t.noProfile} />
        <SignOut />
      </MessengerShell>
    );
  const base = dark ? DarkTheme : DefaultTheme;
  const scope = messengerScopeKey(me._id, tab, capabilities);
  const activeRoute =
    workspaceRoute?.scope === scope ? workspaceRoute.selection : { name: 'Chats' };
  const teamActive = tab === 'staff' && supportInbox === scope;
  const workspace = messengerWorkspace(width, activeRoute.name, teamActive);
  const selectTab = (next: MessengerTab) => {
    setSelected(next);
    setSupportInbox(null);
    setImmersive(false);
  };
  return (
    <LocalMessagesProvider key={me._id} actor={me._id} deployment={client.url}>
      <MessengerShell
        capabilities={capabilities}
        immersive={workspace.split || immersive}
        selected={tab}
        select={selectTab}
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
            onStateChange={state => {
              const route = state?.routes[state.index ?? 0];
              setImmersive((route?.name ?? 'Chats') !== 'Chats');
              const params = route?.params as
                | { threadId?: string; conversationId?: string; storeId?: string }
                | undefined;
              setWorkspaceRoute({ scope, selection: { name: route?.name ?? 'Chats', ...params } });
            }}
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
            <View style={{ flex: 1, flexDirection: rtl ? 'row-reverse' : 'row' }}>
              {workspace.split ? (
                <View
                  style={{
                    width: workspace.sidebarWidth,
                    borderRightWidth: rtl ? 0 : 0.5,
                    borderLeftWidth: rtl ? 0.5 : 0,
                    borderColor: colors.border,
                  }}>
                  <WorkspaceSidebar
                    lane={tab}
                    capabilities={capabilities}
                    select={selectTab}
                    selection={activeRoute}
                    openSupportInbox={() => setSupportInbox(scope)}
                  />
                </View>
              ) : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Stack.Navigator
                  screenOptions={{
                    headerShown: false,
                    headerTintColor: colors.text,
                    headerStyle: { backgroundColor: colors.surface },
                    headerTitleStyle: { fontFamily: consumerTypeface({ rtl, weight: '600' }) },
                    contentStyle: { backgroundColor: colors.background },
                  }}>
                  <Stack.Screen
                    name="Chats"
                    options={{
                      headerShown: false,
                      title:
                        tab === 'friends'
                          ? t.friendsTab
                          : tab === 'marketplace'
                            ? t.marketplaceTab
                            : t.teamView,
                    }}>
                    {props =>
                      workspace.split ? (
                        <Notice text={t.selectConversation} />
                      ) : (
                        <InboxScreen
                          {...props}
                          lane={tab}
                          openSupportInbox={() =>
                            setSupportInbox(messengerScopeKey(me._id, tab, capabilities))
                          }
                        />
                      )
                    }
                  </Stack.Screen>
                  <Stack.Screen
                    name="Conversation"
                    component={ConversationScreen}
                    options={{ title: t.unknown }}
                  />
                  <Stack.Screen
                    name="Support"
                    component={SupportScreen}
                    options={{ headerShown: true, title: t.support }}
                  />
                  <Stack.Screen name="StaffSetup" component={StaffSetupScreen} />
                  <Stack.Screen
                    name="Commerce"
                    component={CommerceScreen}
                    options={{ title: t.unknown }}
                  />
                  <Stack.Screen name="Settings">
                    {props => <SettingsScreen {...props} account={<SignOut row />} />}
                  </Stack.Screen>
                  <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
                  <Stack.Screen name="People" component={PeopleScreen} />
                  <Stack.Screen name="Privacy" component={PrivacyScreen} />
                  <Stack.Screen name="Requests" component={RequestsScreen} />
                  <Stack.Screen name="BlockedPeople" component={BlockedPeopleScreen} />
                  <Stack.Screen name="StoreProfile" component={StoreProfileScreen} />
                  <Stack.Screen name="Profile" component={ProfileScreen} />
                  <Stack.Screen name="Details" component={DetailsScreen} />
                </Stack.Navigator>
              </View>
            </View>
          </NavigationContainer>
        )}
      </MessengerShell>
    </LocalMessagesProvider>
  );
}

function SignOut({ row = false }: { row?: boolean }) {
  const resetSession = useContext(ResetSession);
  const { signOut } = useAuthActions();
  const { t, rtl } = useLocale();
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const exit = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await clearLocalMessageSessions();
      await signOut();
      // A new login must never reuse a prior account's cached queries/mutation queue.
      resetSession();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  if (row)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={failed ? t.retry : t.signOut}
        aria-busy={busy}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => void exit()}
        style={({ pressed }) => ({
          minHeight: 60,
          paddingHorizontal: 16,
          gap: 12,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          opacity: pressed || busy ? 0.55 : 1,
        })}>
        <SettingsIcon name="logout" busy={busy} />
        <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: colors.text }}>
          {failed ? t.retry : t.signOut}
        </Text>
      </Pressable>
    );
  return (
    <IconButton
      name="logout"
      label={failed ? t.retry : t.signOut}
      color={colors.text}
      busy={busy}
      onPress={() => void exit()}
    />
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
