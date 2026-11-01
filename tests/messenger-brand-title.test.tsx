import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MessengerBrandTitle } from '../src/dziri/messenger-brand-title';

const h = vi.hoisted(() => ({
  read: vi.fn<() => Promise<boolean>>(),
  change: undefined as ((value: boolean) => void) | undefined,
  remove: vi.fn(),
}));
vi.mock('react-native', async () => ({
  ...(await import('react-native-web')),
  AccessibilityInfo: {
    isReduceMotionEnabled: h.read,
    addEventListener: (_: string, change: (value: boolean) => void) => {
      h.change = change;
      return { remove: h.remove };
    },
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  h.read.mockReset().mockResolvedValue(false);
  h.remove.mockReset();
  h.change = undefined;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
const show = () =>
  act(async () =>
    root.render(
      <h1 aria-label="Dziri Messenger">
        <MessengerBrandTitle title="Dziri Messenger" />
      </h1>,
    ),
  );
const tick = (ms: number) => act(async () => vi.advanceTimersByTime(ms));

test('native header types once and settles while its accessible name stays complete', async () => {
  await show();
  await tick(1000);
  expect(host.textContent).toContain('Dziri Messenger');
  expect(host.querySelector('h1')?.getAttribute('aria-label')).toBe('Dziri Messenger');
  expect(host.querySelector('[aria-hidden="true"]')).not.toBeNull();
  await tick(3000);
  expect(host.textContent).toBe('DM');
  expect(vi.getTimerCount()).toBe(0);
  await act(async () => root.render(null));
  expect(h.remove).toHaveBeenCalledOnce();
});

test('a preference change wins over a late initial platform response', async () => {
  let resolve!: (value: boolean) => void;
  h.read.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  await show();
  expect(host.textContent).toBe('');
  await act(async () => h.change?.(true));
  expect(host.textContent).toBe('DM');
  await act(async () => resolve(false));
  expect(host.textContent).toBe('DM');
  expect(vi.getTimerCount()).toBe(0);
});

test('an unavailable platform preference leaves a static title with no pending timers', async () => {
  h.read.mockRejectedValue(new Error('synthetic preference unavailable'));
  await show();
  expect(host.textContent).toBe('DM');
  expect(vi.getTimerCount()).toBe(0);
});
