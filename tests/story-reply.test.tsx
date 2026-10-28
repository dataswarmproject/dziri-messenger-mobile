import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { StoryReply } from '../src/dziri/story-reply';
const h = vi.hoisted(() => ({
  me: { _id: 'alice' } as any,
  caps: { features: { storyReplies: 1 } } as any,
  reply: vi.fn(),
  react: vi.fn(),
  open: vi.fn(),
  id: 0,
  locale: 'en',
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => `fixture-${++h.id}` }));
vi.mock('convex/react', () => ({
  useQuery: (ref: any) => (getFunctionName(ref) === 'users:getMe' ? h.me : h.caps),
  useMutation: (ref: any) =>
    ({
      'messaging/storyReply:replyToStory': h.reply,
      'messaging/storyReply:reactToStory': h.react,
      'messaging/threads:createDm': h.open,
    })[getFunctionName(ref)],
}));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({ locale: h.locale, rtl: h.locale === 'ar' }),
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children, accessibilityRole }: any) => (
    <span role={accessibilityRole === 'alert' ? 'alert' : undefined}>{children}</span>
  ),
  TextInput: ({ value, onChangeText, onFocus, onBlur, accessibilityLabel, editable }: any) => (
    <input
      aria-label={accessibilityLabel}
      disabled={editable === false}
      value={value}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={e => onChangeText(e.target.value)}
    />
  ),
}));
vi.mock('../src/dziri/icons', () => ({
  IconButton: ({ label, onPress, disabled, busy }: any) => (
    <button disabled={disabled || busy} aria-label={label} onClick={onPress} />
  ),
}));
vi.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>,
  Pressable: ({ children, onPress, disabled, accessibilityLabel }: any) => (
    <button disabled={disabled} aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
const pause = vi.fn(),
  close = vi.fn(),
  open = vi.fn();
async function show() {
  await act(async () =>
    root.render(
      <StoryReply
        storyId="story"
        authorId="author"
        close={close}
        openConversation={open}
        onPauseChange={pause}
      />,
    ),
  );
}
async function type(value: string) {
  const input = host.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  h.me = { _id: 'alice' };
  h.caps = { features: { storyReplies: 1 } };
  h.locale = 'en';
  h.reply.mockResolvedValue('sent');
  h.react.mockResolvedValue('sent');
  h.open.mockResolvedValue('canonical');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test('native replies use immutable retry IDs and a synchronous duplicate-dispatch lock', async () => {
  let reject!: (e: Error) => void;
  h.reply.mockImplementationOnce(
    () =>
      new Promise((_, bad) => {
        reject = bad;
      }),
  );
  await show();
  await type('Hello');
  const send = host.querySelector<HTMLButtonElement>('[aria-label="Send reply"]')!;
  await act(async () => {
    send.click();
    send.click();
  });
  expect(h.reply).toHaveBeenCalledTimes(1);
  const first = h.reply.mock.calls[0][0];
  await act(async () => reject(new Error('private details')));
  expect(host.textContent).not.toContain('private details');
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Retry"]')!.click());
  expect(h.reply).toHaveBeenCalledTimes(2);
  expect(h.reply.mock.calls[1][0]).toEqual(first);
  expect(host.querySelector('input')!.value).toBe('');
});
test('opening a conversation never sends the reply draft or a placeholder reaction', async () => {
  await show();
  await type('Keep draft');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Open conversation"]')!.click(),
  );
  expect(h.reply).not.toHaveBeenCalled();
  expect(h.react).not.toHaveBeenCalled();
  expect(h.open).toHaveBeenCalledExactlyOnceWith({ otherUserId: 'author' });
  expect(open).toHaveBeenCalledExactlyOnceWith('canonical');
  expect(close).toHaveBeenCalledTimes(1);
});
test('account change clears the old reply and ignores its late acknowledgement', async () => {
  let resolve!: (v: string) => void;
  h.reply.mockImplementationOnce(
    () =>
      new Promise(ok => {
        resolve = ok;
      }),
  );
  await show();
  await type('Alice draft');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Send reply"]')!.click(),
  );
  h.me = { _id: 'bob' };
  await show();
  expect(host.querySelector('input')!.value).toBe('');
  await act(async () => resolve('old-account-message'));
  expect(host.textContent).not.toContain('Reply sent');
});
test('unknown and older backend capabilities expose no reply actions', async () => {
  h.caps = { features: {} };
  await show();
  expect(host.querySelector('input')).toBeNull();
  expect(host.textContent).toContain('unavailable');
  h.caps = undefined;
  await show();
  expect(host.querySelector('button')).toBeNull();
  expect(h.reply).not.toHaveBeenCalled();
});
test('own Stories have no self-DM controls and Arabic labels use the shared copy', async () => {
  h.me = { _id: 'author' };
  await show();
  expect(host.textContent).toBe('');
  h.me = { _id: 'alice' };
  h.locale = 'ar';
  await show();
  expect(host.querySelector('[aria-label="إرسال الرد"]')).not.toBeNull();
});
