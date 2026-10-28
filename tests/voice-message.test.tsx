import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceMessage } from '../src/dziri/voice-message';
const state = vi.hoisted(() => ({
  players: new Map<
    string,
    {
      uri: string;
      play: ReturnType<typeof vi.fn>;
      pause: ReturnType<typeof vi.fn>;
      seekTo: ReturnType<typeof vi.fn>;
    }
  >(),
  status: new Map<
    string,
    {
      duration: number;
      currentTime: number;
      playing: boolean;
      didJustFinish: boolean;
      isLoaded: boolean;
      playbackState: string;
    }
  >(),
}));
vi.mock('expo-audio', () => ({
  useAudioPlayer: (uri: string) => state.players.get(uri),
  useAudioPlayerStatus: (player: { uri: string }) => state.status.get(player.uri),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  View: ({ children, style }: React.PropsWithChildren<{ style?: object }>) => (
    <div data-style={JSON.stringify(style)}>{children}</div>
  ),
  Pressable: ({
    children,
    onPress,
    onKeyDown,
    onLayout,
    disabled,
    accessibilityLabel,
    accessibilityRole,
    accessibilityValue,
  }: React.PropsWithChildren<{
    onPress: (event: object) => void;
    onKeyDown?: React.KeyboardEventHandler;
    onLayout?: (event: object) => void;
    disabled?: boolean;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityValue?: object;
  }>) => {
    React.useEffect(() => {
      onLayout?.({ nativeEvent: { layout: { width: 80 } } });
    }, []);
    return (
      <button
        aria-label={accessibilityLabel}
        role={accessibilityRole === 'adjustable' ? 'slider' : 'button'}
        data-value={JSON.stringify(accessibilityValue)}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onClick={() => onPress({ stopPropagation() {}, nativeEvent: { locationX: 40 } })}>
        {children}
      </button>
    );
  },
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
vi.mock('../src/dziri/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
}));
vi.mock('../src/dziri/ui', () => ({
  useColors: () => ({ outgoing: '#1a1b17', outgoingText: '#fff', surface: '#eee', text: '#000' }),
}));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({
    rtl: true,
    t: {
      playVoice: 'Play',
      pauseVoice: 'Pause',
      voicePosition: 'Position',
      playbackFailed: 'Playback failed',
    },
  }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  state.players.clear();
  state.status.clear();
  for (const uri of ['one', 'two']) {
    state.players.set(uri, {
      uri,
      play: vi.fn(),
      pause: vi.fn(),
      seekTo: vi.fn().mockResolvedValue(undefined),
    });
    state.status.set(uri, {
      duration: 0,
      currentTime: 0,
      playing: false,
      didJustFinish: false,
      isLoaded: true,
      playbackState: 'readyToPlay',
    });
  }
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test('a voice note is one pill with real progress, compact duration and left-to-right seeking in Arabic', async () => {
  state.status.get('one')!.duration = 5.99;
  await act(async () => root.render(<VoiceMessage uri="one" durationMs={6000} outgoing />));
  expect(host.textContent).toContain('0:06');
  expect(host.textContent).not.toContain('/');
  expect(JSON.parse(host.firstElementChild!.getAttribute('data-style')!)).toMatchObject({
    backgroundColor: '#1a1b17',
    direction: 'ltr',
    minHeight: 56,
  });
  await act(async () => host.querySelector<HTMLButtonElement>('[role="slider"]')!.click());
  expect(state.players.get('one')!.seekTo).toHaveBeenCalledWith(2.995);
});
test('starting one recording pauses other players and finished notes restart from zero', async () => {
  state.status.get('one')!.didJustFinish = true;
  await act(async () =>
    root.render(
      <>
        <VoiceMessage uri="one" durationMs={6000} />
        <VoiceMessage uri="two" durationMs={6000} />
      </>,
    ),
  );
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Play"]')!.click());
  expect(state.players.get('two')!.pause).toHaveBeenCalled();
  expect(state.players.get('one')!.seekTo).toHaveBeenCalledWith(0);
  expect(state.players.get('one')!.play).toHaveBeenCalledOnce();
});
test('seek failures are visible and do not claim a changed playback position', async () => {
  state.players.get('one')!.seekTo.mockRejectedValueOnce(new Error('unavailable'));
  await act(async () => root.render(<VoiceMessage uri="one" durationMs={6000} />));
  await act(async () => host.querySelector<HTMLButtonElement>('[role="slider"]')!.click());
  expect(host.textContent).toContain('Playback failed');
  expect(JSON.parse(host.querySelector('[role="slider"]')!.getAttribute('data-value')!).now).toBe(
    0,
  );
});
