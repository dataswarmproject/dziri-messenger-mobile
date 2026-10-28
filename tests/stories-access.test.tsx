import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { StoriesStrip } from '../src/dziri/stories-strip';
import { StoryViewer } from '../src/dziri/story-viewer';
import type { StoryRecord } from '../src/dziri/api';
const state = vi.hoisted(() => ({
  stories: [] as StoryRecord[] | undefined,
  view: vi.fn(),
  media: undefined as any,
  imageLoads: new Map<string, () => void>(),
  onAppState: undefined as undefined | ((state: string) => void),
}));
vi.mock('convex/react', () => ({ useQuery: () => state.stories, useMutation: () => state.view }));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({
    rtl: false,
    locale: 'en',
    t: {
      yourStory: 'Your story',
      stories: 'Stories',
      close: 'Close',
      next: 'Next',
      back: 'Back',
      unavailable: 'Unavailable',
    },
  }),
}));
vi.mock('../src/dziri/ui', () => ({
  useColors: () => ({
    background: '#fff',
    surface: '#eee',
    text: '#111',
    secondary: '#666',
    primary: '#111',
  }),
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('../src/dziri/story-reply', () => ({ StoryReply: () => null }));
vi.mock('../src/dziri/story-composer', () => ({ StoryComposer: () => null }));
vi.mock('../src/dziri/media-preview', () => ({
  MediaPreview: (props: any) => {
    state.media = props;
    return <span>Media:{props.media.uri}</span>;
  },
}));
vi.mock('../src/dziri/icons', () => ({
  IconButton: ({ label, onPress }: any) => <button aria-label={label} onClick={onPress} />,
}));
vi.mock('expo-image', () => ({
  Image: ({ source, onLoad }: any) => {
    if (onLoad) state.imageLoads.set(source.uri, onLoad);
    return <img src={source.uri} onLoad={onLoad} />;
  },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  KeyboardAvoidingView: ({ children }: any) => <div>{children}</div>,
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, callback: (value: string) => void) => {
      state.onAppState = callback;
      return { remove() {} };
    },
  },
  View: ({ children }: any) => <div>{children}</div>,
  ScrollView: ({ children }: any) => <div>{children}</div>,
  Modal: ({ children }: any) => <section role="dialog">{children}</section>,
  Pressable: ({ children, accessibilityLabel, onPress }: any) => (
    <button aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
function story(id = 'one', body = 'Private story', type = 'text'): StoryRecord {
  return {
    _id: id,
    authorId: 'author',
    authorName: 'Author',
    type,
    body,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
    iHaveViewed: false,
    moderationStatus: 'clean',
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.stories = [story()];
  state.view.mockResolvedValue(null);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
test('an open Story follows live edits and disappears as soon as access is revoked', async () => {
  await act(async () => root.render(<StoriesStrip />));
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Author"]')!.click());
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Private story');
  state.stories = [{ ...state.stories![0], body: 'Updated story' }];
  await act(async () => root.render(<StoriesStrip />));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Updated story');
  state.stories = [];
  await act(async () => root.render(<StoriesStrip />));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => vi.advanceTimersByTime(1000));
  expect(state.view).not.toHaveBeenCalled();
});
test('expiry closes a stalled media Story even when playback never becomes ready', async () => {
  const close = vi.fn(),
    item = {
      ...story('video', '', 'video'),
      expiresAt: Date.now() + 100,
      mediaUrl: 'https://example.test/fixture.mp4',
    };
  await act(async () => root.render(<StoryViewer items={[item]} close={close} />));
  await act(async () => vi.advanceTimersByTime(101));
  expect(close).toHaveBeenCalledTimes(1);
  expect(state.view).not.toHaveBeenCalled();
});
test('live list reordering preserves the current Story identity', async () => {
  const first = story('one', 'First'),
    second = story('two', 'Second'),
    close = vi.fn();
  await act(async () => root.render(<StoryViewer items={[first, second]} close={close} />));
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Next story"]')!.click(),
  );
  expect(host.textContent).toContain('Second');
  await act(async () => root.render(<StoryViewer items={[second, first]} close={close} />));
  expect(host.textContent).toContain('Second');
  expect(host.textContent).not.toContain('First');
});

test('late media callbacks from the previous Story cannot record a view on the new one', async () => {
  const first = { ...story('photo', '', 'photo'), mediaUrl: 'https://example.test/photo.jpg' };
  const second = { ...story('video', '', 'video'), mediaUrl: 'https://example.test/video.mp4' };
  await act(async () => root.render(<StoryViewer items={[first, second]} close={vi.fn()} />));
  const lateImageLoad = state.imageLoads.get(first.mediaUrl)!;
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Next story"]')!.click(),
  );
  await act(async () => lateImageLoad());
  await act(async () => vi.advanceTimersByTime(501));
  expect(state.view).not.toHaveBeenCalled();
  await act(async () => state.media.onPlayingChange(true));
  await act(async () => vi.advanceTimersByTime(501));
  expect(state.view).toHaveBeenCalledExactlyOnceWith({ storyId: 'video' });
});
test('removing the selected Story closes the viewer instead of switching to another private item', async () => {
  const first = story(),
    second = story('two', 'Second'),
    close = vi.fn();
  await act(async () => root.render(<StoryViewer items={[first, second]} close={close} />));
  await act(async () => root.render(<StoryViewer items={[second]} close={close} />));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(close).toHaveBeenCalledTimes(1);
});

test('native pause/resume preserves elapsed progress and does not duplicate receipts', async () => {
  const close = vi.fn();
  await act(async () => root.render(<StoryViewer items={[story()]} close={close} />));
  await act(async () => vi.advanceTimersByTime(2000));
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Pause story"]')!.click(),
  );
  await act(async () => vi.advanceTimersByTime(10000));
  expect(close).not.toHaveBeenCalled();
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Play story"]')!.click(),
  );
  await act(async () => vi.advanceTimersByTime(2900));
  expect(close).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(200));
  expect(close).toHaveBeenCalledTimes(1);
  expect(state.view).toHaveBeenCalledTimes(1);
});
test('background suspension pauses native media and stops view dwell', async () => {
  const item = { ...story('video', '', 'video'), mediaUrl: 'https://example.test/video.mp4' };
  await act(async () => root.render(<StoryViewer items={[item]} close={vi.fn()} />));
  await act(async () => state.media.onPlayingChange(true));
  await act(async () => state.onAppState!('background'));
  expect(state.media.paused).toBe(true);
  await act(async () => vi.advanceTimersByTime(1000));
  expect(state.view).not.toHaveBeenCalled();
  await act(async () => state.onAppState!('active'));
  expect(state.media.paused).toBe(false);
});

test('a failed old media attempt cannot overwrite a successful retry', async () => {
  const item = { ...story('video', '', 'video'), mediaUrl: 'https://example.test/video.mp4' };
  await act(async () => root.render(<StoryViewer items={[item]} close={vi.fn()} />));
  const oldError = state.media.onError;
  await act(async () => oldError());
  expect(host.textContent).toContain('could not be loaded');
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Retry"]')!.click());
  await act(async () => oldError());
  expect(host.textContent).not.toContain('could not be loaded');
  await act(async () => state.media.onPlayingChange(true));
  await act(async () => vi.advanceTimersByTime(501));
  expect(state.view).toHaveBeenCalledExactlyOnceWith({ storyId: 'video' });
});
