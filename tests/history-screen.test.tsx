import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFunctionName } from 'convex/server';
import { DetailsScreen } from '../src/dziri/details';
const state = vi.hoisted(() => ({
  commerce: false,
  results: [] as object[],
  status: 'CanLoadMore',
  load: vi.fn(),
  navigate: vi.fn(),
  args: [] as unknown[],
}));
vi.mock('react-native', () => ({
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollView: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Pressable: ({
    children,
    onPress,
    accessibilityLabel,
  }: React.PropsWithChildren<{ onPress: () => void; accessibilityLabel?: string }>) => (
    <button aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock('expo-image', () => ({ Image: () => null }));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  TextInput: ({
    value,
    onChangeText,
    accessibilityLabel,
  }: {
    value: string;
    onChangeText: (value: string) => void;
    accessibilityLabel: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      value={value}
      onInput={event => onChangeText(event.currentTarget.value)}
    />
  ),
}));
vi.mock('../src/dziri/figma', () => ({
  FigmaIcon: () => null,
  FigmaButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
vi.mock('../src/dziri/media-preview', () => ({ MediaPreview: () => null }));
vi.mock('../src/dziri/ui', () => ({
  useColors: () => ({ background: '#fff', text: '#000', surface: '#eee', secondary: '#777' }),
  Notice: () => <span>Unavailable</span>,
}));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({
    rtl: false,
    locale: 'en',
    t: {
      app: 'Dziri',
      searchMessages: 'Search messages',
      searchSoFar: 'matches so far',
      searchComplete: 'matches · Entire history searched',
      searchingHistory: 'Searching history…',
      searchOlder: 'Search older messages',
      searchTwoCharacters: 'Type at least 2 characters',
      media: 'Media',
      close: 'Back',
      audio: 'Audio',
      video: 'Video',
      older: 'Older messages',
    },
  }),
}));
vi.mock('convex/react', () => ({
  useMutation: () => async () => null,
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === 'skip') return undefined;
    const name = getFunctionName(ref);
    if (name.endsWith(':capabilities')) return { features: { historyPages: 1 } };
    if (name.endsWith(':listThreads')) return [];
    return state.commerce
      ? { otherName: 'Peer', storeName: 'Store' }
      : { title: 'Peer', encryption: 'server' };
  },
  usePaginatedQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args !== 'skip') state.args.push({ name: getFunctionName(ref), args });
    return args === 'skip'
      ? { results: [], status: 'Exhausted', loadMore: state.load }
      : { results: state.results, status: state.status, loadMore: state.load };
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  state.commerce = false;
  state.results = [];
  state.status = 'CanLoadMore';
  state.load.mockClear();
  state.navigate.mockClear();
  state.args = [];
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const render = () =>
  act(async () =>
    root.render(
      <DetailsScreen
        {...({
          route: {
            params: state.commerce
              ? { conversationId: 'commerce', storeId: 'store' }
              : { threadId: 'thread' },
          },
          navigation: { navigate: state.navigate, goBack: () => {} },
        } as never)}
      />,
    ),
  );
async function search() {
  await act(async () => {
    const input = host.querySelector('input')!;
    input.value = 'needle';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
test('search labels incomplete history honestly and a result opens its exact personal message', async () => {
  await render();
  await search();
  expect(state.load).toHaveBeenCalledWith(50);
  expect(host.textContent).toContain('matches so far');
  expect(host.textContent).not.toContain('Entire history searched');
  state.results = [
    { _id: 'old', body: 'Needle in old history', senderName: 'Peer', createdAt: 100 },
  ];
  state.status = 'Exhausted';
  await render();
  const row = [...host.querySelectorAll('button')].find(button =>
    button.textContent?.includes('Needle in old history'),
  )!;
  await act(async () => row.click());
  expect(state.navigate).toHaveBeenCalledWith(
    'Conversation',
    expect.objectContaining({ threadId: 'thread', focusMessageId: 'old' }),
  );
  expect(host.textContent).toContain('Entire history searched');
});
test('Marketplace pagination and result navigation retain seller store scope', async () => {
  state.commerce = true;
  state.status = 'Exhausted';
  state.results = [
    { _id: 'market-message', content: 'Needle seller reply', senderName: 'Peer', createdAt: 100 },
  ];
  await render();
  await search();
  expect(state.args).toContainEqual({
    name: 'marketplaceMessages:listMessagePage',
    args: { conversationId: 'commerce', storeId: 'store' },
  });
  const row = [...host.querySelectorAll('button')].find(button =>
    button.textContent?.includes('Needle seller reply'),
  )!;
  await act(async () => row.click());
  expect(state.navigate).toHaveBeenCalledWith('Commerce', {
    conversationId: 'commerce',
    storeId: 'store',
    focusMessageId: 'market-message',
  });
});
