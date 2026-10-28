import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getFunctionName } from 'convex/server';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTyping } from '../src/dziri/use-typing';
const state = vi.hoisted(() => ({
  focused: true,
  rows: [] as { userId: string; state: string; expiresAt: number }[],
  publish: vi.fn(),
  clear: vi.fn(),
  appChange: undefined as ((value: string) => void) | undefined,
}));
vi.mock('convex/react', () => ({
  useQuery: () => state.rows,
  useMutation: (ref: never) =>
    getFunctionName(ref).endsWith(':setTyping') ? state.publish : state.clear,
}));
vi.mock('@react-navigation/native', () => ({ useIsFocused: () => state.focused }));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, callback: (value: string) => void) => {
      state.appChange = callback;
      return { remove: vi.fn() };
    },
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement, result: ReturnType<typeof useTyping>;
function Probe({ enabled = true }: { enabled?: boolean }) {
  result = useTyping('thread', enabled);
  return <span>{result.people.length}</span>;
}
const render = (enabled = true) => act(async () => root.render(<Probe enabled={enabled} />));
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10000);
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  state.focused = true;
  state.rows = [];
  state.publish.mockReset().mockResolvedValue(null);
  state.clear.mockReset().mockResolvedValue(null);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
test('draft restoration is silent; real typing is throttled and expires after idle', async () => {
  await render();
  expect(state.publish).not.toHaveBeenCalled();
  await act(async () => {
    result.activity('a');
    result.activity('ab');
  });
  expect(state.publish).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(2500));
  await act(async () => result.activity('abc'));
  expect(state.publish).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(state.clear).toHaveBeenCalledOnce();
});
test('focus loss and backgrounding clear activity and cannot publish from inactive screens', async () => {
  await render();
  await act(async () => result.activity('draft'));
  state.focused = false;
  await render();
  expect(state.clear).toHaveBeenCalledOnce();
  await act(async () => result.activity('hidden'));
  expect(state.publish).toHaveBeenCalledOnce();
  state.focused = true;
  await render();
  await act(async () => result.activity('visible'));
  await act(async () => state.appChange?.('background'));
  expect(state.clear).toHaveBeenCalledTimes(2);
  await act(async () => result.activity('background'));
  expect(state.publish).toHaveBeenCalledTimes(2);
});
test('expired incoming indicators disappear without waiting for server cleanup; read-only screens hide them', async () => {
  state.rows = [{ userId: 'peer', state: 'typing', expiresAt: 12000 }];
  await render();
  expect(result.people).toHaveLength(1);
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(result.people).toHaveLength(0);
  await render(false);
  expect(result.people).toHaveLength(0);
});
