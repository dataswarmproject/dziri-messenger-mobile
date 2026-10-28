import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { SharedMedia } from '../src/dziri/shared-media';
const open = vi.hoisted(() => vi.fn());
vi.mock('react-native', () => ({
  Linking: { openURL: open },
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Pressable: ({
    children,
    onPress,
    accessibilityRole,
    accessibilityLabel,
  }: React.PropsWithChildren<{
    onPress: () => void;
    accessibilityRole?: string;
    accessibilityLabel?: string;
  }>) => (
    <button role={accessibilityRole} aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
vi.mock('../src/dziri/icons', () => ({ Icon: () => null }));
vi.mock('../src/dziri/media-preview', () => ({
  MediaPreview: ({ media }: { media: { uri: string } }) => <span>{media.uri}</span>,
}));
vi.mock('../src/dziri/ui', () => ({ useColors: () => ({}) }));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({ rtl: true, t: new Proxy({}, { get: (_, key) => String(key) }) }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test('audio and documents use separate tabs and restricted rows disappear immediately', async () => {
  const rows = [
    { id: 'voice', media: { type: 'voice' as const, uri: 'https://example.com/audio' } },
    { id: 'file', media: { type: 'file' as const, uri: 'https://example.com/doc' } },
  ];
  const render = (restricted = false) =>
    act(async () =>
      root.render(
        <SharedMedia
          rows={rows.map(row => ({ ...row, ...(restricted ? { deletedAt: 0 } : {}) }))}
          status="CanLoadMore"
          loadMore={() => {}}
        />,
      ),
    );
  await render();
  expect(host.textContent).toContain('sharedLoaded');
  await act(async () =>
    [...host.querySelectorAll('button')].find(b => b.textContent === 'audio')!.click(),
  );
  expect(host.textContent).toContain('https://example.com/audio');
  expect(host.textContent).not.toContain('https://example.com/doc');
  await act(async () =>
    [...host.querySelectorAll('button')].find(b => b.textContent === 'files')!.click(),
  );
  expect(host.textContent).toContain('https://example.com/doc');
  await render(true);
  expect(host.textContent).not.toContain('https://example.com/doc');
  expect(host.textContent).toContain('sharedEmptyLoaded');
});
test('pagination reports completion only after exhaustion; historical limits never claim completion', async () => {
  const load = vi.fn();
  await act(async () =>
    root.render(<SharedMedia rows={[]} status="CanLoadMore" loadMore={load} />),
  );
  await act(async () =>
    [...host.querySelectorAll('button')].find(b => b.textContent === 'older')!.click(),
  );
  expect(load).toHaveBeenCalledOnce();
  await act(async () =>
    root.render(<SharedMedia rows={[]} status="LoadingMore" loadMore={load} />),
  );
  expect(host.textContent).not.toContain('sharedComplete');
  await act(async () => root.render(<SharedMedia rows={[]} status="Exhausted" loadMore={load} />));
  expect(host.textContent).toContain('sharedComplete');
  await act(async () =>
    root.render(<SharedMedia rows={[]} status="Exhausted" limited loadMore={load} />),
  );
  expect(host.textContent).not.toContain('sharedComplete');
  expect(host.textContent).toContain('historyLimited');
});
