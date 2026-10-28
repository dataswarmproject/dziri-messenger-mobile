import { test, expect, vi } from 'vitest';
import { createMessageVault } from '../src/dziri/message-vault';
import { createOutbox } from '../src/dziri/outbox';
const row = {
  id: 'old',
  body: 'Original retained text',
  createdAt: 1,
  status: 'failed' as const,
  media: {
    type: 'file' as const,
    storageId: 'storage',
    uri: 'local',
    mime: 'application/pdf',
    size: 3,
    name: 'invoice.pdf',
  },
};
function fixture() {
  let disk: string | null = null;
  const io = {
    read: async () => disk,
    write: async (value: string) => {
      disk = value;
    },
    remove: async () => {},
    seal: async (value: string) => 'sealed:' + value,
    open: async (value: string) => value.slice(7),
  };
  return { io, vault: createMessageVault(io, () => 1000) };
}
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
test('removal preserves the latest draft and other scopes, and stale saves cannot resurrect the removed command after reopening', async () => {
  const f = fixture();
  await f.vault.save('chat', { body: 'Current draft', pending: [row] });
  await f.vault.save('other', { body: 'Other draft', pending: [{ ...row, id: 'other' }] });
  const stale = (await f.vault.read('chat')).pending;
  expect(await f.vault.removePending('chat', row)).toBe(true);
  await f.vault.save('chat', { body: 'Newer unsent draft', pending: stale });
  const reopened = createMessageVault(f.io, () => 1000);
  expect(await reopened.read('chat')).toEqual({ body: 'Newer unsent draft', pending: [] });
  expect((await reopened.read('other')).pending[0].id).toBe('other');
});
test('a stale confirmation cannot remove changed content under the same local identifier', async () => {
  const f = fixture();
  await f.vault.save('chat', { body: 'Draft', pending: [{ ...row, body: 'Replacement intent' }] });
  expect(await f.vault.removePending('chat', row)).toBe(false);
  expect((await f.vault.read('chat')).pending[0].body).toBe('Replacement intent');
});
test('a failed or silently ignored removal write never reports success or removes the visible original', async () => {
  const f = fixture();
  await f.vault.save('chat', { body: 'Draft', pending: [row] });
  f.io.write = async () => {};
  await expect(f.vault.removePending('chat', row)).rejects.toThrow();
  expect((await f.vault.read('chat')).pending[0].id).toBe(row.id);
});
test('an active transport cannot be discarded and local removal never sends or acknowledges a server message', async () => {
  let release!: () => void;
  const wait = new Promise<void>(r => (release = r)),
    wire = vi.fn(async () => wait),
    remove = vi.fn(async () => true);
  let visible: any[] = [];
  const box = createOutbox(
    wire,
    () => row.id,
    rows => (visible = rows),
    () => 1,
    undefined,
    undefined,
    undefined,
    remove,
  );
  box.enqueue(row.body);
  await flush();
  expect(await box.discard({ ...row, media: undefined, status: 'pending' })).toBe(false);
  expect(remove).not.toHaveBeenCalled();
  release();
  await flush();
  expect(visible[0].status).toBe('sent');
});
test('successful asynchronous removal preserves another newly queued command and frees a slot only after persistence', async () => {
  let release!: () => void;
  const wait = new Promise<void>(r => (release = r)),
    wire = vi.fn(async () => {
      throw Error('offline');
    });
  let visible: any[] = [];
  const box = createOutbox(
    wire,
    () => 'new',
    rows => (visible = rows),
    () => 2,
    undefined,
    undefined,
    undefined,
    async () => {
      await wait;
      return true;
    },
  );
  box.restore([row]);
  const removing = box.discard(row);
  expect(visible.some(r => r.id === row.id)).toBe(true);
  box.enqueue('New intent');
  await flush();
  release();
  expect(await removing).toBe(true);
  expect(visible.map(r => r.id)).toEqual(['new']);
});
test('retiring the queue before a retained confirmation prevents any removal call', async () => {
  const remove = vi.fn(async () => true);
  const box = createOutbox(
    async () => {},
    () => 'new',
    () => {},
    () => 2,
    undefined,
    undefined,
    undefined,
    remove,
  );
  box.restore([row]);
  box.deactivate();
  expect(await box.discard(row)).toBe(false);
  expect(remove).not.toHaveBeenCalled();
});

test('removal protection survives journal-capacity pressure and fails a new save without losing existing protected copies', async () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) {
    await f.vault.save('chat' + i, { pending: [row] });
    expect(await f.vault.removePending('chat' + i, row)).toBe(true);
  }
  await expect(f.vault.save('extra', { body: 'New draft' })).rejects.toThrow('capacity');
  const reopened = createMessageVault(f.io, () => 1000);
  await reopened.save('chat0', { pending: [row] });
  expect((await reopened.read('chat0')).pending).toEqual([]);
  expect((await reopened.read('extra')).body).toBe('');
});

test('serialized removal and a later draft edit retain both decisions', async () => {
  const f = fixture();
  await f.vault.save('chat', { body: 'Before', pending: [row] });
  const removed = f.vault.removePending('chat', row),
    saved = f.vault.save('chat', { body: 'Edited while removing', pending: [row] });
  expect(await removed).toBe(true);
  await saved;
  expect(await createMessageVault(f.io, () => 1000).read('chat')).toEqual({
    body: 'Edited while removing',
    pending: [],
  });
});

test('equivalent captured scope property ordering does not prevent removal after encrypted restoration', async () => {
  const f = fixture(),
    key = 'v1:' + 'a'.repeat(64);
  const scoped = {
    ...row,
    personalScope: {
      threadId: 'chat',
      commandContext: { expectedActorId: 'alice', authorityKey: key },
    },
  };
  await f.vault.save('chat', { pending: [scoped] });
  expect(
    await f.vault.removePending('chat', {
      ...scoped,
      personalScope: {
        commandContext: { authorityKey: key, expectedActorId: 'alice' },
        threadId: 'chat',
      },
    }),
  ).toBe(true);
});
