import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StaffLogin } from '../src/inbox/app';
vi.mock('react-native', async () => import('react-native-web'));
vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));
vi.mock('expo-image', () => ({ Image: () => null }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: () => null,
  SafeAreaView: () => null,
}));
vi.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: () => null }));
vi.mock('../src/dziri/fonts', () => ({ consumerFonts: {} }));
vi.mock('../src/dziri/locale', () => ({ useLocale: () => ({ locale: 'en', rtl: false }) }));
vi.mock('../src/inbox/handoff-panel', () => ({ StaffHandoffGate: () => null }));
const require = createRequire(import.meta.url);
const previous = require.extensions['.svg'];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  require.extensions['.svg'] = module => {
    module.exports = '';
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  if (previous) require.extensions['.svg'] = previous;
  else delete require.extensions['.svg'];
});
test('a blocked password form cannot bypass pending-handoff review through the keyboard', async () => {
  const login = vi.fn(async () => undefined);
  await act(async () => {
    root.render(
      <StaffLogin
        origin="https://synthetic-inbox.invalid"
        initialEmail="agent@synthetic.invalid"
        login={login}
        busy
        error=""
      />,
    );
  });
  const input = host.querySelector<HTMLInputElement>('input[aria-label="Password"]')!;
  await act(async () => {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }),
    );
  });
  expect(login).not.toHaveBeenCalled();
  expect(input.readOnly).toBe(true);
});
