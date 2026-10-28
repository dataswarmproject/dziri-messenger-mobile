import React, { act, forwardRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { MessageComposer } from '../src/dziri/message-composer';
vi.mock('react-native', () => ({
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pressable: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => (
    <button onClick={onPress}>{children}</button>
  ),
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TextInput: forwardRef<
    HTMLTextAreaElement,
    { value: string; onChangeText: (s: string) => void; accessibilityLabel: string }
  >((p, ref) => (
    <textarea
      ref={ref}
      aria-label={p.accessibilityLabel}
      value={p.value}
      onChange={e => p.onChangeText(e.target.value)}
    />
  )),
}));
vi.mock('../src/dziri/icons', () => ({
  IconButton: ({
    label,
    onPress,
    disabled,
    busy,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    busy?: boolean;
  }) => (
    <button aria-label={label} disabled={disabled || busy} onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock('../src/dziri/figma', () => ({
  FigmaButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button aria-label={label} disabled={disabled} onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock('../src/dziri/message-bubble', () => ({ ReplyQuote: () => null }));
vi.mock('../src/dziri/media-preview', () => ({ MediaPreview: () => null }));
vi.mock('../src/dziri/camera', () => ({ CameraCapture: () => null }));
vi.mock('../src/dziri/expression-picker', () => ({ ExpressionPicker: () => null }));
vi.mock('../src/dziri/ui', () => ({
  useColors: () => ({
    text: '#111',
    surface: '#eee',
    background: '#fff',
    secondary: '#666',
    primary: '#111',
  }),
}));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({
    rtl: false,
    t: {
      camera: 'Camera',
      photo: 'Photo',
      recording: 'Record voice',
      message: 'Message',
      tools: 'More actions',
      sendLike: 'Send a thumbs up',
      send: 'Send',
      emoji: 'Emoji',
    },
  }),
}));
const media = vi.hoisted(() => ({ choose: vi.fn(), startVoice: vi.fn(), change: vi.fn() }));
vi.mock('../src/dziri/use-attachment', () => ({
  useAttachment: () => ({
    ...media,
    attachment: null,
    recording: false,
    failed: false,
    seconds: 0,
  }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root, submit: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  submit = vi.fn().mockReturnValue(true);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const button = (label: string) =>
  host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
async function render() {
  await act(async () =>
    root.render(
      <MessageComposer
        reply={null}
        cancelReply={() => {}}
        submit={submit}
        submitMedia={() => true}
      />,
    ),
  );
}
async function type(value: string) {
  await act(async () => {
    const node = host.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

test('empty composer exposes the screenshot media shortcuts; typing collapses them to leave room for the draft', async () => {
  await render();
  for (const label of ['Camera', 'Photo', 'Record voice', 'Send a thumbs up'])
    expect(button(label)).not.toBeNull();
  await act(async () => button('Photo')!.click());
  expect(media.choose).toHaveBeenCalledOnce();
  expect(submit).not.toHaveBeenCalled();
  await type('Hello');
  expect(button('Photo')).toBeNull();
  expect(button('Record voice')).toBeNull();
  expect(button('Send')).not.toBeNull();
});
test('whitespace-only text still dispatches a thumbs-up when the like control is tapped', async () => {
  await render();
  await type('  ');
  await act(async () => button('Send a thumbs up')!.click());
  expect(submit).toHaveBeenCalledExactlyOnceWith('👍', undefined);
});
test('a queue-capacity rejection preserves the composer draft', async () => {
  submit.mockReturnValue(false);
  await render();
  await type('Keep this draft');
  await act(async () => button('Send')!.click());
  expect(host.querySelector('textarea')?.value).toBe('Keep this draft');
});
