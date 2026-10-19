import React, {
  Component,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, Pressable, Text, View, useColorScheme } from 'react-native';
import { ConvexReactClient, useConvexAuth, useQuery } from 'convex/react';
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
import { LocaleProvider, useLocale } from './locale';
import { LanguageChoice, Notice, useColors } from './ui';
import { SignInScreen } from './auth';
import { InboxScreen } from './inbox';
import { ConversationScreen } from './conversation';
import { dziriApi } from './api';
import type { MessengerRoutes } from './routes';

const Stack = createNativeStackNavigator<MessengerRoutes>();
const ResetSession = createContext(() => {});
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

export default function DziriApp() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LocaleProvider>
          <Bootstrap />
        </LocaleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Bootstrap() {
  const { t } = useLocale();
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  const [fontsLoaded, fontError] = useFonts({
    'Inter-400-20': require('../assets/fonts/Inter-400-20.ttf'),
    'Inter-420-20': require('../assets/fonts/Inter-420-20.ttf'),
    'Inter-500-24': require('../assets/fonts/Inter-500-24.ttf'),
    'Inter-580-24': require('../assets/fonts/Inter-580-24.ttf'),
    'Inter-600-20': require('../assets/fonts/Inter-600-20.ttf'),
  });
  const url = deploymentUrl(Constants.expoConfig?.extra?.convexUrl ?? '', __DEV__);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {fontError ? (
        <Notice text={t.failed} />
      ) : !fontsLoaded ? (
        <Notice text={t.loading} busy />
      ) : url ? (
        <ConnectedApp url={url} />
      ) : (
        <View style={{ flex: 1 }}>
          <Notice text={`${t.config}. ${t.configHint}`} />
          <LanguageChoice />
        </View>
      )}
    </SafeAreaView>
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
  if (isLoading) return <Notice text={t.loading} busy />;
  return isAuthenticated ? <UserNavigator /> : <SignInScreen />;
}

function UserNavigator() {
  const me = useQuery(dziriApi.me, {});
  const { t } = useLocale();
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  if (me === undefined) return <Notice text={t.loading} busy />;
  if (!me)
    return (
      <View style={{ flex: 1 }}>
        <Notice text={t.noProfile} />
        <SignOut />
      </View>
    );
  const base = dark ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer
      key={me._id}
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
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen
          name="Chats"
          component={InboxScreen}
          options={{ title: t.chats, headerRight: () => <SignOut /> }}
        />
        <Stack.Screen
          name="Conversation"
          component={ConversationScreen}
          options={{ title: t.unknown }}
        />
      </Stack.Navigator>
    </NavigationContainer>
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
    <View style={{ flex: 1 }}>
      <Notice text={t.failed} />
      <Pressable accessibilityRole="button" onPress={retry} style={tailwind.style('p-3')}>
        <Text style={{ color: colors.primary, textAlign: 'center' }}>{t.retry}</Text>
      </Pressable>
      <SignOut />
    </View>
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
