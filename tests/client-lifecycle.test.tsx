import React, { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ConvexReactClient } from 'convex/react';
import { SessionRuntime } from '../src/dziri/app';

const observed = vi.hoisted(() => ({ clients: [] as any[] }));

// Keep the real Convex SDK. The auth/native/navigation/screens are unrelated
// boundaries: no user identity, storage operation or network server is needed.
vi.mock('@convex-dev/auth/react', () => ({
  ConvexAuthProvider: ({ client }: { client: unknown }) => {
    observed.clients.push(client);
    return <div data-testid="auth-boundary" />;
  },
  useAuthActions: () => ({ signOut: () => Promise.resolve() }),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, Pressable: () => null, View: () => null }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('expo-constants', () => ({ default: {} }));
vi.mock('expo-font', () => ({ useFonts: () => [true] }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: () => null }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: () => null, SafeAreaView: () => null }));
vi.mock('@react-navigation/native', () => ({ DarkTheme: {}, DefaultTheme: {}, NavigationContainer: () => null }));
vi.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: () => ({}) }));
vi.mock('../src/theme', () => ({ tailwind: { style: () => ({}) } }));
vi.mock('../src/dziri/fonts', () => ({ consumerFonts: {} }));
vi.mock('../src/dziri/typeface', () => ({ consumerTypeface: {} }));
vi.mock('../src/dziri/typography', () => ({ Text: () => null }));
vi.mock('../src/dziri/locale', () => ({ useLocale: () => ({ t: {} }) }));
vi.mock('../src/dziri/ui', () => ({ Notice: () => null, useColors: () => ({}) }));
vi.mock('../src/dziri/auth', () => ({ SignInScreen: () => null, SignUpCompletion: () => null }));
vi.mock('../src/dziri/inbox', () => ({ InboxScreen: () => null }));
vi.mock('../src/dziri/conversation', () => ({ ConversationScreen: () => null }));
vi.mock('../src/dziri/api', () => ({ dziriApi: {} }));
vi.mock('../src/dziri/support', () => ({ SupportScreen: () => null, SupportTargetProvider: () => null }));
vi.mock('../src/shell', () => ({ MessengerShell: () => null }));
vi.mock('../src/dziri/commerce', () => ({ CommerceScreen: () => null }));
vi.mock('../src/dziri/icons', () => ({ IconButton: () => null }));
vi.mock('../src/dziri/use-personal-push', () => ({ usePersonalPush: () => {} }));
vi.mock('../src/dziri/settings-icon', () => ({ SettingsIcon: () => null }));
vi.mock('../src/dziri/appearance', () => ({ useAppearance: () => ({ dark: false }) }));
vi.mock('../src/dziri/settings', () => ({ SettingsScreen: () => null, PrivacyScreen: () => null, ProfileSettingsScreen: () => null }));
vi.mock('../src/dziri/people', () => ({ PeopleScreen: () => null }));
vi.mock('../src/dziri/details', () => ({ DetailsScreen: () => null }));
vi.mock('../src/dziri/use-presence', () => ({ usePresenceHeartbeat: () => {} }));
vi.mock('../src/dziri/directory-profile', () => ({ StoreProfileScreen: () => null, ProfileScreen: () => null }));
vi.mock('../src/dziri/workspace-sidebar', () => ({ WorkspaceSidebar: () => null }));
vi.mock('../src/dziri/safety', () => ({ BlockedPeopleScreen: () => null }));
vi.mock('../src/dziri/local-messages', () => ({ LocalMessagesProvider: () => null, clearLocalMessageSessions: () => {} }));
vi.mock('../src/dziri/startup-screen', () => ({ StartupScreen: () => null }));
vi.mock('../src/dziri/staff-setup', () => ({ StaffSetupScreen: () => null }));
vi.mock('../src/dziri/request-report', () => ({ RequestsScreen: () => null }));

class SyntheticWebSocket {
  static instances: SyntheticWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: unknown = null;
  onerror: unknown = null;
  constructor(readonly url: string) {
    SyntheticWebSocket.instances.push(this);
    queueMicrotask(() => {
      if (this.readyState === 0) {
        this.readyState = 1;
        this.onopen?.();
      }
    });
  }
  send() {}
  close() {
    this.readyState = 3;
    queueMicrotask(() => this.onclose?.());
  }
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const firstUrl = 'https://synthetic-first.convex.cloud';
const secondUrl = 'https://synthetic-second.convex.cloud';
let root: Root, host: HTMLDivElement, unmounted: boolean;
const currentClient = () => observed.clients.at(-1) as ConvexReactClient;
const render = (url = firstUrl, key = 'session') =>
  act(async () => root.render(<SessionRuntime key={key} url={url} reset={() => {}} />));

beforeEach(() => {
  observed.clients.length = 0;
  SyntheticWebSocket.instances = [];
  vi.stubGlobal('WebSocket', SyntheticWebSocket);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  unmounted = false;
});
afterEach(async () => {
  if (!unmounted) await act(async () => root.unmount());
  await Promise.all([...new Set(observed.clients)].map(client => client.close()));
  host.remove();
  vi.unstubAllGlobals();
});

test('StrictMode effect replay leaves the mounted real Convex client usable', async () => {
  await act(async () =>
    root.render(<StrictMode><SessionRuntime url={firstUrl} reset={() => {}} /></StrictMode>),
  );
  const client = currentClient();
  expect(client).toBeInstanceOf(ConvexReactClient);
  expect(host.querySelector('[data-testid="auth-boundary"]')).not.toBeNull();
  expect(() => client.connectionState()).not.toThrow();
  await act(async () => {});
  expect(SyntheticWebSocket.instances).toHaveLength(1);
});

test('ordinary renders retain the current client; a new URL retires only the old client', async () => {
  await render();
  const first = currentClient();
  expect(() => first.connectionState()).not.toThrow();
  await render();
  expect(currentClient()).toBe(first);
  await render(secondUrl);
  const second = currentClient();
  expect(second).not.toBe(first);
  expect(second.url).toBe(secondUrl);
  expect(() => first.connectionState()).toThrow('already been closed');
  expect(() => second.connectionState()).not.toThrow();
  await act(async () => {});
  expect(SyntheticWebSocket.instances[0].readyState).toBe(3);
});

test('true unmount closes the real client and its active socket', async () => {
  await render();
  const client = currentClient();
  expect(() => client.connectionState()).not.toThrow();
  await act(async () => {});
  expect(SyntheticWebSocket.instances[0].readyState).toBe(1);
  await act(async () => root.unmount());
  unmounted = true;
  expect(() => client.connectionState()).toThrow('already been closed');
  expect(SyntheticWebSocket.instances[0].readyState).toBe(3);
});

test('a replacement session on the same URL cannot retain the previous client cache', async () => {
  await render();
  const previous = currentClient();
  expect(() => previous.connectionState()).not.toThrow();
  await render(firstUrl, 'replacement-session');
  const replacement = currentClient();
  expect(replacement).not.toBe(previous);
  expect(() => previous.connectionState()).toThrow('already been closed');
  expect(() => replacement.connectionState()).not.toThrow();
});
