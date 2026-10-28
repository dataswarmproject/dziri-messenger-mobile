import React, { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LocalMessagesProvider,
  useLocalDraft,
  clearLocalMessageSessions,
} from '../src/dziri/local-messages';
import { useOutbox } from '../src/dziri/use-outbox';
import { createMessageVault } from '../src/dziri/message-vault';
const state = vi.hoisted(() => ({ vaults: new Map<string, unknown>() }));
vi.mock('../src/dziri/message-vault-storage', () => ({
  openAccountVault: async (_: string, actor: string) => state.vaults.get(actor),
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'new-command' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  state.vaults.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  await clearLocalMessageSessions();
});
function vault(actor: string) {
  let disk: string | null = null;
  const value = createMessageVault({
    read: async () => disk,
    write: async text => {
      disk = text;
    },
    remove: async () => {
      disk = null;
    },
    seal: async text => text,
    open: async text => text,
  });
  state.vaults.set(actor, value);
  return value;
}
function Draft() {
  const draft = useLocalDraft('friends:one');
  return (
    <>
      <span>{draft.body}</span>
      <button onClick={() => draft.setBody('New private draft')}>Type</button>
    </>
  );
}

test('the real queue hook removes only the confirmed local command and persists its removal across remounts', async () => {
  const saved = vault('alice'),
    send = vi.fn(async () => null);
  const original = {
    id: 'retained',
    body: 'Retained private intent',
    createdAt: Date.now(),
    status: 'failed' as const,
  };
  await saved.save('friends:one', {
    body: 'New private draft',
    pending: [original, { ...original, id: 'other' }],
  });
  let queue: ReturnType<typeof useOutbox>;
  function Queue() {
    queue = useOutbox(send, [], 'friends:one');
    return <span>{queue.drafts.map(row => row.id).join(',')}</span>;
  }
  const render = () =>
    act(async () =>
      root.render(
        <LocalMessagesProvider actor="alice" deployment="test">
          <Queue />
        </LocalMessagesProvider>,
      ),
    );
  await render();
  let result = false;
  await act(async () => {
    result = await queue.discard(original);
  });
  expect(result).toBe(true);
  expect(host.textContent).toBe('other');
  expect(await saved.read('friends:one')).toEqual({
    body: 'New private draft',
    pending: [{ ...original, id: 'other' }],
  });
  await act(async () => root.render(<div />));
  await saved.save('friends:one', { pending: [original, { ...original, id: 'other' }] });
  await render();
  expect(host.textContent).toBe('other');
  expect(send).not.toHaveBeenCalled();
});
test('a remounted draft restores only its authenticated account and sign-out removes it', async () => {
  const alice = vault('alice'),
    bob = vault('bob');
  await alice.save('friends:one', { body: 'Alice draft' });
  await bob.save('friends:one', { body: 'Bob draft' });
  await act(async () =>
    root.render(
      <LocalMessagesProvider actor="alice" deployment="test">
        <Draft />
      </LocalMessagesProvider>,
    ),
  );
  expect(host.textContent).toContain('Alice draft');
  await act(async () =>
    root.render(
      <LocalMessagesProvider key="bob" actor="bob" deployment="test">
        <Draft />
      </LocalMessagesProvider>,
    ),
  );
  expect(host.textContent).toContain('Bob draft');
  expect(host.textContent).not.toContain('Alice draft');
  await clearLocalMessageSessions();
  await expect(bob.read('friends:one')).rejects.toThrow('closed');
});
test('restored queue is visible without sending; explicit retry retains its id and acknowledgement clears the cache', async () => {
  const saved = vault('alice'),
    send = vi.fn(async () => null);
  await saved.save('friends:one', {
    body: 'Still typing',
    pending: [{ id: 'original', body: 'Queued', status: 'pending', createdAt: Date.now() }],
  });
  function Queue({ confirmed }: { confirmed: string[] }) {
    const outbox = useOutbox(send, confirmed, 'friends:one');
    return (
      <>
        <span>{outbox.drafts.map(row => `${row.id}:${row.status}`)}</span>
        <button onClick={() => outbox.retry('original')}>Retry</button>
      </>
    );
  }
  const render = (confirmed: string[]) =>
    act(async () =>
      root.render(
        <LocalMessagesProvider actor="alice" deployment="test">
          <Queue confirmed={confirmed} />
        </LocalMessagesProvider>,
      ),
    );
  await render([]);
  expect(host.textContent).toContain('original:failed');
  expect(send).not.toHaveBeenCalled();
  await act(async () => host.querySelector('button')!.click());
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ id: 'original' }));
  await render(['original']);
  expect((await saved.read('friends:one')).pending).toEqual([]);
  expect((await saved.read('friends:one')).body).toBe('Still typing');
});

test('leaving a conversation before recovery storage completes cannot dispatch its queued message', async () => {
  let release!: () => void;
  const saved = vault('alice'),
    persist = saved.save.bind(saved),
    send = vi.fn(async () => null);
  const blocked = new Promise<void>(resolve => {
    release = resolve;
  });
  vi.spyOn(saved, 'save').mockImplementation(async (...args) => {
    await blocked;
    return persist(...args);
  });
  function Queue() {
    const outbox = useOutbox(send, [], 'friends:one');
    return (
      <button disabled={!outbox.ready} onClick={() => outbox.enqueue('Private draft')}>
        Send fixture
      </button>
    );
  }
  await act(async () =>
    root.render(
      <LocalMessagesProvider actor="alice" deployment="test">
        <Queue />
      </LocalMessagesProvider>,
    ),
  );
  await act(async () => host.querySelector('button')!.click());
  await act(async () => root.render(<div>Another conversation</div>));
  await act(async () => release());
  expect(send).not.toHaveBeenCalled();
});
test('sign out cancels queued dispatch before waiting for local storage cleanup', async () => {
  let release!: () => void;
  const saved = vault('alice'),
    send = vi.fn(async () => null);
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  vi.spyOn(saved, 'save').mockImplementation(async () => pending);
  function Queue() {
    const outbox = useOutbox(send, [], 'friends:one');
    return (
      <button disabled={!outbox.ready} onClick={() => outbox.enqueue('Do not send after logout')}>
        Send fixture
      </button>
    );
  }
  await act(async () =>
    root.render(
      <LocalMessagesProvider actor="alice" deployment="test">
        <Queue />
      </LocalMessagesProvider>,
    ),
  );
  await act(async () => host.querySelector('button')!.click());
  await act(async () => {
    const cleared = clearLocalMessageSessions();
    release();
    await cleared;
  });
  expect(send).not.toHaveBeenCalled();
});

test('StrictMode remounts keep new sends available without auto-retrying recovered work', async () => {
  const saved = vault('alice'),
    send = vi.fn(async () => null);
  await saved.save('friends:one', {
    pending: [{ id: 'recovered', body: 'Recovered', createdAt: Date.now(), status: 'pending' }],
  });
  function Queue() {
    const box = useOutbox(send, [], 'friends:one');
    return (
      <button disabled={!box.ready} onClick={() => box.enqueue('New explicit send')}>
        Send fixture
      </button>
    );
  }
  await act(async () =>
    root.render(
      <StrictMode>
        <LocalMessagesProvider actor="alice" deployment="test">
          <Queue />
        </LocalMessagesProvider>
      </StrictMode>,
    ),
  );
  expect(send).not.toHaveBeenCalled();
  expect(host.querySelector('button')!.disabled).toBe(false);
  await act(async () => host.querySelector('button')!.click());
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ body: 'New explicit send' }));
});
test('changing the provider actor without a parent key hides old drafts and cancels old pending dispatch', async () => {
  const alice = vault('alice'),
    bob = vault('bob'),
    send = vi.fn(async () => null),
    save = alice.save.bind(alice);
  await alice.save('friends:one', { body: 'Alice private text' });
  await bob.save('friends:one', { body: 'Bob draft' });
  let release!: () => void;
  const barrier = new Promise<void>(resolve => {
    release = resolve;
  });
  vi.spyOn(alice, 'save').mockImplementation(async (...args) => {
    await barrier;
    return save(...args);
  });
  function Account() {
    const draft = useLocalDraft('friends:one'),
      box = useOutbox(send, [], 'friends:one');
    return (
      <>
        <span>{draft.body}</span>
        <span>{box.drafts.map(r => r.body)}</span>
        <button disabled={!box.ready} onClick={() => box.enqueue('Alice queued')}>
          Send fixture
        </button>
      </>
    );
  }
  const render = (actor: string) =>
    act(async () =>
      root.render(
        <LocalMessagesProvider actor={actor} deployment="test">
          <Account />
        </LocalMessagesProvider>,
      ),
    );
  await render('alice');
  await act(async () => host.querySelector('button')!.click());
  await render('bob');
  expect(host.textContent).toContain('Bob draft');
  expect(host.textContent).not.toContain('Alice');
  await act(async () => release());
  expect(send).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('Alice');
  expect((await alice.read('friends:one')).pending[0].body).toBe('Alice queued');
});

test('a scope change hides the previous queue while the next history loads and ignores a late transport failure', async () => {
  const saved = vault('alice'),
    read = saved.read.bind(saved);
  await saved.save('friends:two', {
    pending: [
      { id: 'second-thread', body: 'Second conversation', createdAt: Date.now(), status: 'failed' },
    ],
  });
  let releaseRead!: () => void, rejectSend!: (error: Error) => void;
  const reading = new Promise<void>(resolve => {
    releaseRead = resolve;
  });
  vi.spyOn(saved, 'read').mockImplementation(async scope => {
    if (scope === 'friends:two') await reading;
    return read(scope);
  });
  const send = vi.fn(
    () =>
      new Promise<void>((_, reject) => {
        rejectSend = reject;
      }),
  );
  function Queue({ scope }: { scope: string }) {
    const box = useOutbox(send, [], scope);
    return (
      <>
        <span>{box.drafts.map(r => r.body)}</span>
        <button disabled={!box.ready} onClick={() => box.enqueue('First conversation')}>
          Send fixture
        </button>
      </>
    );
  }
  const render = (scope: string) =>
    act(async () =>
      root.render(
        <LocalMessagesProvider actor="alice" deployment="test">
          <Queue scope={scope} />
        </LocalMessagesProvider>,
      ),
    );
  await render('friends:one');
  await act(async () => host.querySelector('button')!.click());
  expect(send).toHaveBeenCalledTimes(1);
  await render('friends:two');
  expect(host.textContent).not.toContain('First conversation');
  expect(host.querySelector('button')!.disabled).toBe(true);
  await act(async () => rejectSend(new Error('Old request failed')));
  expect(host.textContent).not.toContain('First conversation');
  await act(async () => releaseRead());
  expect(host.textContent).toContain('Second conversation');
  expect(send).toHaveBeenCalledTimes(1);
});
