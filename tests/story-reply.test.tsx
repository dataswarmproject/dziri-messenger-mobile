import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { StoryReply } from '../src/dziri/story-reply';
const h = vi.hoisted(() => ({
  me: { _id: 'alice' } as any,
  caps: { features: { storyReplies: 1, storyWriteScope: 1 } } as any,
  pending: undefined as any,
  prepared: {
    writeContext: { expectedActorId: 'alice', authorityKey: 'v1:' + 'a'.repeat(64) },
    canSend: true,
  } as any,
  reply: vi.fn(),
  hash: vi.fn(),
  react: vi.fn(),
  open: vi.fn(),
  id: 0,
  retries: [] as (() => void)[],
  locale: 'en',
}));
vi.mock('expo-crypto', () => ({
  randomUUID: () => `fixture-${++h.id}`,
  digestStringAsync: h.hash,
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
vi.mock('convex/react', () => ({
  useQuery: (ref: any, args: any) => {
    const name = getFunctionName(ref);
    if (name.includes('prepareReply')) {
      h.pending = args.pendingCommand;
      return h.prepared;
    }
    return name === 'users:getMe' ? h.me : h.caps;
  },
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
  Pressable: ({ children, onPress, disabled, accessibilityLabel }: any) => {
    if (accessibilityLabel === 'Retry') h.retries.push(onPress);
    return (
      <button disabled={disabled} aria-label={accessibilityLabel} onClick={onPress}>
        {children}
      </button>
    );
  },
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
  h.retries = [];
  h.hash.mockResolvedValue('0c'.repeat(32));
  h.prepared = {
    writeContext: { expectedActorId: 'alice', authorityKey: 'v1:' + 'a'.repeat(64) },
    canSend: true,
  };
  h.me = { _id: 'alice' };
  h.caps = { features: { storyReplies: 1, storyWriteScope: 1 } };
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

test('account replacement during hashing never submits the old native Story draft', async () => {
  let finish!: (value: string) => void;
  h.hash.mockImplementationOnce(
    () =>
      new Promise(ok => {
        finish = ok;
      }),
  );
  await show();
  await type('Private old account draft');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Send reply"]')!.click(),
  );
  expect(h.reply).not.toHaveBeenCalled();
  h.me = { _id: 'replacement' };
  h.prepared = {
    writeContext: { expectedActorId: 'replacement', authorityKey: 'v1:' + 'b'.repeat(64) },
    canSend: true,
  };
  await show();
  await act(async () => finish('0c'.repeat(32)));
  expect(host.querySelector('input')!.value).toBe('');
  expect(h.reply).not.toHaveBeenCalled();
});

test('native draft is hidden while canonical actor and account observations disagree', async () => {
  await show();
  await type('Hidden until coherent');
  h.prepared = {
    writeContext: { expectedActorId: 'replacement', authorityKey: 'v1:' + 'b'.repeat(64) },
    canSend: true,
  };
  await show();
  expect(host.querySelector('input')).toBeNull();
  expect(host.textContent).not.toContain('Hidden until coherent');
  expect(h.reply).not.toHaveBeenCalled();
});

test('native acknowledgement lookup sends only submitted ID and hash without body', async () => {
  h.reply.mockRejectedValueOnce(Error('uncertain'));
  await show();
  await type('Synthetic private submitted body');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Send reply"]')!.click(),
  );
  expect(Object.keys(h.pending).sort()).toEqual(['clientMessageId', 'payloadHash']);
  expect(JSON.stringify(h.pending)).not.toContain('Synthetic private submitted body');
});
test('opening a conversation never sends the reply draft or a placeholder reaction', async () => {
  await show();
  await type('Keep draft');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Open conversation"]')!.click(),
  );
  expect(h.reply).not.toHaveBeenCalled();
  expect(h.react).not.toHaveBeenCalled();
  expect(h.open).toHaveBeenCalledExactlyOnceWith({
    otherUserId: 'author',
    expectedActorId: 'alice',
  });
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
  h.prepared = {
    ...h.prepared,
    writeContext: { ...h.prepared.writeContext, expectedActorId: 'bob' },
  };
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

test('native Story transport captures the canonical actor and grant', async () => {
  await show();
  await type('Captured native reply');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Send reply"]')!.click(),
  );
  expect(h.reply.mock.calls[0][0].commandContext).toEqual(h.prepared.writeContext);
});
test('native Story controls do not fall back when captured-write capability is absent', async () => {
  h.caps = { features: { storyReplies: 1 } };
  await show();
  expect(host.querySelector('input')).toBeNull();
  expect(h.reply).not.toHaveBeenCalled();
});
test('native late Story acknowledgement cannot clear a draft after the grant changes', async () => {
  let resolve!: (id: string) => void;
  h.reply.mockImplementationOnce(
    () =>
      new Promise(ok => {
        resolve = ok;
      }),
  );
  await show();
  await type('Keep original native Story reply');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Send reply"]')!.click(),
  );
  const original = h.reply.mock.calls[0][0];
  h.prepared = null;
  await show();
  await act(async () => resolve('old-message'));
  expect(host.querySelector('input')!.value).toBe('Keep original native Story reply');
  expect(host.textContent).not.toContain('Reply sent');
  h.prepared = {
    writeContext: { expectedActorId: 'alice', authorityKey: 'v1:' + 'b'.repeat(64) },
    canSend: true,
  };
  await show();
  const retry = host.querySelector<HTMLButtonElement>('[aria-label="Retry"]');
  expect(!retry || retry.disabled).toBe(true);
  expect(h.reply).toHaveBeenCalledTimes(1);
  expect(original.commandContext.authorityKey).toBe('v1:' + 'a'.repeat(64));
});
test('native first-DM confirmation recovers a lost result without resending', async () => {
  h.reply.mockRejectedValueOnce(Error('lost result'));
  await show();
  await type('Confirmed native Story reply');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Send reply"]')!.click(),
  );
  const context = h.reply.mock.calls[0][0].commandContext;
  h.prepared = {
    writeContext: { expectedActorId: 'alice', authorityKey: 'v1:' + 'b'.repeat(64) },
    canSend: false,
    confirmation: {
      messageId: 'message',
      clientMessageId: h.pending.clientMessageId,
      payloadHash: h.pending.payloadHash,
      commandContext: context,
    },
  };
  await show();
  expect(host.textContent).toContain('Reply sent');
  expect(host.querySelector('input')!.value).toBe('');
  expect(h.reply).toHaveBeenCalledTimes(1);
});

test('a delayed Retry press cannot replay a different newer Story command', async () => {
  h.reply.mockRejectedValue(Error('uncertain result'));
  await show();
  await type('First original reply');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Send reply"]')!.click(),
  );
  const oldRetry = h.retries.at(-1)!;
  h.prepared = {
    writeContext: { expectedActorId: 'alice', authorityKey: 'v1:' + 'b'.repeat(64) },
    canSend: true,
  };
  await show();
  await type('New explicit reply');
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Send reply"]')!.click(),
  );
  expect(h.reply).toHaveBeenCalledTimes(2);
  await act(async () => oldRetry());
  expect(h.reply).toHaveBeenCalledTimes(2);
});

test('temporary captured-write capability loss preserves the native Story draft without a fallback', async () => {
  await show();
  await type('Retain native rollout draft');
  h.caps = { features: { storyReplies: 1, storyWriteScope: 0 } };
  await show();
  expect(host.querySelector('input')?.value).toBe('Retain native rollout draft');
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Send reply"]')?.disabled).toBe(true);
  expect(h.reply).not.toHaveBeenCalled();
  h.caps = { features: { storyReplies: 1, storyWriteScope: 1 } };
  await show();
  expect(host.querySelector('input')!.value).toBe('Retain native rollout draft');
  expect(h.reply).not.toHaveBeenCalled();
});
