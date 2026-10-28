import { expect, test, vi } from 'vitest';
import { createOutbox } from '../src/dziri/outbox';
import { createMessageVault } from '../src/dziri/message-vault';
import {
  capturePersonalWriteScope,
  assertPersonalWriteScope,
} from '../src/dziri/message-writes.generated';
const context = { expectedActorId: 'alice', authorityKey: 'v1:' + 'a'.repeat(64) };
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
test('captured personal intent survives a failed command, encrypted persistence and explicit retry', async () => {
  const scope = capturePersonalWriteScope({
    actorId: 'alice',
    threadId: 'chat',
    supported: true,
    context,
  })!;
  let disk: string | null = null;
  const io = {
    read: async () => disk,
    write: async (s: string) => {
      disk = s;
    },
    remove: async () => {},
    seal: async (s: string) => s,
    open: async (s: string) => s,
  };
  const vault = createMessageVault(io, () => 2),
    send = vi.fn(async () => {
      throw Error('lost acknowledgement');
    });
  const box = createOutbox(
    send,
    () => 'original-id',
    () => {},
    () => 1,
    rows => vault.save('friends:thread:chat', { pending: rows }),
    undefined,
    scope,
  );
  box.enqueue('Synthetic');
  await flush();
  const saved = await createMessageVault(io, () => 2).read('friends:thread:chat');
  expect(saved.pending[0].personalScope).toEqual(scope);
  const restored = createOutbox(
    send,
    () => 'other-id',
    () => {},
    () => 2,
    undefined,
    undefined,
    scope,
  );
  restored.restore(saved.pending);
  await flush();
  expect(send).toHaveBeenCalledTimes(1);
  restored.retry('original-id');
  await flush();
  expect(send.mock.calls[1][0].personalScope).toEqual(scope);
});
test('restored old-grant and legacy commands cannot silently acquire a fresh personal scope', async () => {
  const old = capturePersonalWriteScope({
    actorId: 'alice',
    threadId: 'chat',
    supported: true,
    context,
  })!;
  const current = capturePersonalWriteScope({
    actorId: 'alice',
    threadId: 'chat',
    supported: true,
    context: { ...context, authorityKey: 'v1:' + 'b'.repeat(64) },
  })!;
  const wire = vi.fn();
  let rows: any[] = [];
  const box = createOutbox(
    async draft => {
      assertPersonalWriteScope(current, draft.personalScope);
      await wire(draft);
    },
    () => 'new',
    value => {
      rows = value;
    },
    () => 2,
    undefined,
    undefined,
    current,
  );
  box.restore([
    { id: 'old', body: 'Retained old grant', createdAt: 1, status: 'failed', personalScope: old },
    { id: 'legacy', body: 'Retained legacy', createdAt: 1, status: 'failed' },
  ]);
  box.retry('old');
  box.retry('legacy');
  await flush();
  expect(wire).not.toHaveBeenCalled();
  expect(rows.map(r => r.body)).toEqual(['Retained old grant', 'Retained legacy']);
});
