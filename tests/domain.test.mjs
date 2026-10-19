import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentUrl, secureStorageKey } from '../src/dziri/config.ts';
import { createTextSender } from '../src/dziri/text-sender.ts';
import { canSendText, messageText, storedReceipt } from '../src/dziri/message-policy.ts';

test('encryption-marked or frozen threads cannot send plaintext; subscriber rules stay intact', () => {
  const thread = { isFrozen: false, encryption: 'server', isReadOnly: false, myRole: 'member' };
  assert.equal(canSendText(thread), true);
  assert.equal(canSendText({ ...thread, encryption: 'e2ee' }), false);
  assert.equal(canSendText({ ...thread, isFrozen: true }), false);
  assert.equal(canSendText({ ...thread, isReadOnly: true, myRole: 'subscriber' }), false);
  assert.equal(canSendText({ ...thread, isReadOnly: true, myRole: 'owner' }), true);
});

test('deleted/ciphertext messages never leak a residual plaintext body', () => {
  const labels = {
    deleted: 'deleted',
    unsupported: 'unsupported',
    encryptionUnavailable: 'encrypted',
  };
  const message = { type: 'text', body: 'private', senderId: 'me', createdAt: 100 };
  assert.equal(messageText({ ...message, deletedAt: 101 }, labels), 'deleted');
  assert.equal(messageText({ ...message, ciphertext: 'opaque' }, labels), 'encrypted');
  assert.equal(messageText({ ...message, type: 'image' }, labels), 'unsupported');
  assert.equal(messageText(message, labels), 'private');
});

test('seen requires an actual peer cursor, applies only to outgoing stored messages', () => {
  const message = { senderId: 'me', createdAt: 100 };
  assert.equal(storedReceipt(message, 'me'), 'sent');
  assert.equal(storedReceipt(message, 'me', 99), 'sent');
  assert.equal(storedReceipt(message, 'me', 100), 'seen');
  assert.equal(storedReceipt(message, 'someone-else', 200), null);
  assert.equal(storedReceipt({ ...message, deletedAt: 101 }, 'me', 200), null);
});

test('deployment configuration fails closed and only allows loopback HTTP in development', () => {
  assert.equal(deploymentUrl('', true), null);
  assert.equal(
    deploymentUrl('https://example.convex.cloud', false),
    'https://example.convex.cloud',
  );
  assert.equal(deploymentUrl('http://localhost:3210', true), 'http://localhost:3210');
  for (const url of [
    'http://localhost:3210',
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com/path',
    'https://example.com?token=x',
    'https://example.com#token',
    'garbage',
  ]) {
    assert.equal(deploymentUrl(url, false), null, url);
  }
});

test('secure-store keys are valid and collision-free for punctuation that existing auth keys use', () => {
  const keys = [
    'a/b',
    'a_b',
    'a@b',
    'a:b',
    'a.b',
    'https://one.convex.cloud',
    'https://two.convex.cloud',
  ];
  const encoded = keys.map(secureStorageKey);
  assert.equal(new Set(encoded).size, keys.length);
  for (const key of encoded) assert.match(key, /^[a-zA-Z0-9._-]+$/);
});

test('lost acknowledgement retry reuses one logical send ID without supplying actor identity', async () => {
  const sent = [];
  let ids = 0;
  const sender = createTextSender(
    async args => {
      sent.push(args);
      if (sent.length === 1) throw new Error('lost acknowledgement');
      return 'canonical-message';
    },
    () => `logical-${++ids}`,
  );
  await assert.rejects(sender.send('thread-a', '  سلام Dziri  '));
  assert.equal(await sender.send('thread-a', '  سلام Dziri  '), 'canonical-message');
  assert.deepEqual(sent, [
    { threadId: 'thread-a', body: 'سلام Dziri', clientMessageId: 'logical-1' },
    { threadId: 'thread-a', body: 'سلام Dziri', clientMessageId: 'logical-1' },
  ]);
});

test('a second intentional send after acknowledgement gets a new ID even with the same text', async () => {
  const sent = [];
  let ids = 0;
  const sender = createTextSender(
    async args => {
      sent.push(args);
      return 'stored';
    },
    () => `id-${++ids}`,
  );
  await sender.send('thread-a', 'hello');
  await sender.send('thread-a', 'hello');
  assert.notEqual(sent[0].clientMessageId, sent[1].clientMessageId);
});

test('edited failed content or another thread cannot reuse a previous retry key', async () => {
  const sent = [];
  let ids = 0;
  const sender = createTextSender(
    async args => {
      sent.push(args);
      throw new Error('offline');
    },
    () => `id-${++ids}`,
  );
  await assert.rejects(sender.send('thread-a', 'first'));
  await assert.rejects(sender.send('thread-a', 'edited'));
  await assert.rejects(sender.send('thread-b', 'edited'));
  assert.equal(new Set(sent.map(item => item.clientMessageId)).size, 3);
});

test('concurrent send attempts cannot produce two requests', async () => {
  let finish;
  let requests = 0;
  const sender = createTextSender(
    () => {
      requests++;
      return new Promise(resolve => {
        finish = resolve;
      });
    },
    () => 'id',
  );
  const first = sender.send('thread-a', 'hello');
  await assert.rejects(sender.send('thread-a', 'hello'), /in progress/);
  finish('stored');
  assert.equal(await first, 'stored');
  assert.equal(requests, 1);
});

test('empty or oversized text is rejected before making a backend request', async () => {
  let requests = 0;
  const sender = createTextSender(
    async () => {
      requests++;
      return 'stored';
    },
    () => 'id',
  );
  await assert.rejects(sender.send('thread-a', '   '));
  await assert.rejects(sender.send('thread-a', 'x'.repeat(8001)));
  assert.equal(requests, 0);
});
