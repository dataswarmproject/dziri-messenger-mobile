import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { createMessageVault } from '../src/dziri/message-vault.ts';

function fixture() {
  const disk = new Map(),
    key = randomBytes(32);
  const vault = namespace =>
    createMessageVault({
      read: async () => disk.get(namespace) ?? null,
      write: async value => disk.set(namespace, value),
      remove: async () => disk.delete(namespace),
      seal: async value => {
        const iv = randomBytes(12),
          cipher = createCipheriv('aes-256-gcm', key, iv);
        cipher.setAAD(Buffer.from(namespace));
        return Buffer.concat([
          iv,
          cipher.update(value, 'utf8'),
          cipher.final(),
          cipher.getAuthTag(),
        ]).toString('base64');
      },
      open: async value => {
        const data = Buffer.from(value, 'base64');
        const cipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
        cipher.setAAD(Buffer.from(namespace));
        cipher.setAuthTag(data.subarray(-16));
        return Buffer.concat([cipher.update(data.subarray(12, -16)), cipher.final()]).toString(
          'utf8',
        );
      },
    });
  return { disk, vault };
}
const command = {
  id: 'stable-command',
  body: 'Private body مرحبا',
  createdAt: Date.now(),
  status: 'pending',
};

test('encrypted journals survive restart, preserve stable commands and never contain plaintext on disk', async () => {
  const { disk, vault } = fixture();
  await vault('alice').save('friends:one', { body: 'Unsent private draft', pending: [command] });
  assert.equal(disk.get('alice').includes('Private'), false);
  const restored = await vault('alice').read('friends:one');
  assert.equal(restored.body, 'Unsent private draft');
  assert.equal(restored.pending[0].id, command.id);
  assert.equal(restored.pending[0].status, 'failed');
  assert.deepEqual(await vault('alice').read('marketplace:one:store'), { body: '', pending: [] });
});
test('account binding rejects substituted ciphertext and sign-out prevents late writes', async () => {
  const { disk, vault } = fixture();
  const alice = vault('alice');
  await alice.save('thread', { body: 'secret', pending: [] });
  disk.set('bob', disk.get('alice'));
  await assert.rejects(vault('bob').read('thread'));
  await alice.clear();
  await assert.rejects(alice.save('thread', { body: 'late completion', pending: [] }));
  assert.equal(disk.has('alice'), false);
});
test('serialized partial updates retain both the current draft and queue; expiry removes old commands', async () => {
  const { vault } = fixture();
  const store = vault('alice');
  await Promise.all([
    store.save('thread', { body: 'Newest draft' }),
    store.save('thread', { pending: [command] }),
  ]);
  const value = await store.read('thread');
  assert.equal(value.body, 'Newest draft');
  assert.equal(value.pending.length, 1);
  await store.save('thread', { pending: [{ ...command, createdAt: Date.now() - 86400001 }] });
  assert.equal((await store.read('thread')).pending.length, 0);
});
test('capacity/validation failures preserve the previously saved draft', async () => {
  const { vault } = fixture();
  const store = vault('alice');
  await store.save('thread', { body: 'Preserved', pending: [] });
  await assert.rejects(store.save('thread', { body: 'x'.repeat(8001) }));
  await assert.rejects(
    store.save('thread', { pending: Array.from({ length: 21 }, () => command) }),
  );
  assert.equal((await store.read('thread')).body, 'Preserved');
});
test('server-acknowledged commands are never restored as failed messages', async () => {
  const { vault } = fixture();
  const store = vault('alice');
  await store.save('thread', { body: 'Still typing', pending: [{ ...command, status: 'sent' }] });
  assert.deepEqual((await vault('alice').read('thread')).pending, []);
});
test('document retries restore their immutable storage receipt and filename from the encrypted journal', async () => {
  const { disk, vault } = fixture();
  const media = { type: 'file', storageId: 'stored-pdf', uri: 'file:///cache/document.pdf', mime: 'application/pdf', size: 400, name: 'private-invoice.pdf' };
  await vault('alice').save('thread', { pending: [{ ...command, media }] });
  assert.equal(disk.get('alice').includes(media.name), false);
  const restored = (await vault('alice').read('thread')).pending[0];
  assert.equal(restored.status, 'failed'); assert.deepEqual(restored.media, media);
});
