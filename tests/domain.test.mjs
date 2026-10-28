import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentUrl, secureStorageKey } from '../src/dziri/config.ts';
import { createTextSender } from '../src/dziri/text-sender.ts';
import {
  canSendText,
  messageText,
  storedReceipt,
  deliveryState,
  displayMedia,
} from '../src/dziri/message-policy.ts';
import { createOutbox } from '../src/dziri/outbox.ts';
import { uploadMedia, MAX_MEDIA_BYTES } from '../src/dziri/media-upload.ts';
import { messageDirection } from '../src/dziri/typeface.ts';
import { insertExpression, searchDarija } from '../src/dziri/expression-contract.generated.ts';
import { graphemeSegments } from 'unicode-segmenter/grapheme';

test('outbox retries freeze the reply and media command despite caller or presentation mutation', async () => {
  const sent = [];
  let visible = [];
  const outbox = createOutbox(
    async command => {
      sent.push(command);
      throw new Error('lost acknowledgement');
    },
    () => 'immutable',
    drafts => {
      visible = drafts;
    },
  );
  const reply = { id: 'parent', body: 'Original quote', deleted: false };
  const media = {
    uri: 'file:///image',
    storageId: 'stored-image',
    type: 'image',
    mime: 'image/png',
    size: 1,
  };
  outbox.enqueueMedia(media, 'Caption', reply);
  await new Promise(resolve => setTimeout(resolve, 0));
  reply.id = 'different-parent';
  media.storageId = 'different-image';
  visible[0].reply.id = 'presentation-parent';
  visible[0].media.storageId = 'presentation-image';
  sent[0].reply.id = 'transport-parent';
  outbox.retry('immutable');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(sent[1].id, 'immutable');
  assert.equal(sent[1].reply.id, 'parent');
  assert.equal(sent[1].media.storageId, 'stored-image');
});

test('canonical acknowledgement before a failed response never resurrects the queued command', async () => {
  let fail;
  let visible;
  const outbox = createOutbox(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
    () => 'ack-first',
    value => {
      visible = value;
    },
  );
  outbox.enqueue('Hello');
  outbox.acknowledge(['ack-first']);
  fail(new Error('response lost'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(visible, []);
});
test('native cursor insertion uses Hermes-compatible graphemes and canonical Darija aliases', () => {
  const body = 'x👩🏽‍💻y';
  assert.deepEqual(insertExpression(body, 4, 4, '❤️', 100, graphemeSegments(body)), {
    value: 'x❤️y',
    caret: 3,
  });
  assert.equal(searchDarija('رَبِّي يَحْفَظَك')[0].id, 'rabi-yahafdek');
});

test('sticker retry keeps its selected resource, reply and stable command ID', async () => {
  const sent = [];
  const outbox = createOutbox(
    async draft => {
      sent.push(draft);
      if (sent.length === 1) throw new Error('ack lost');
    },
    () => 'stable-sticker',
    () => {},
    () => 1,
  );
  const sticker = { id: 'approved-sticker', uri: 'https://example.com/sticker.webp' };
  const reply = { id: 'parent', senderName: 'Alice', deleted: false };
  assert.equal(outbox.enqueueSticker(sticker, reply), true);
  sticker.id = 'changed-after-selection';
  await new Promise(resolve => setTimeout(resolve, 0));
  outbox.retry('stable-sticker');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(sent.length, 2);
  assert.equal(sent[1].id, 'stable-sticker');
  assert.equal(sent[1].sticker.id, 'approved-sticker');
  assert.equal(sent[1].reply.id, 'parent');
});

test('message direction follows the first strong letter independently of UI language', () => {
  assert.equal(messageDirection('مرحبا', false), 'rtl');
  assert.equal(messageDirection('123 👋 مرحبا Dziri', false), 'rtl');
  assert.equal(messageDirection('Bonjour مرحبا', true), 'ltr');
  assert.equal(messageDirection('https://dziri.app/مرحبا', true), 'ltr');
  assert.equal(messageDirection('שלום', false), 'rtl');
  assert.equal(messageDirection('123 👍', true), 'rtl');
  assert.equal(messageDirection('', false), 'ltr');
});

test('deleted, encrypted and moderated media cannot render residual URLs', () => {
  const m = {
    type: 'image',
    mediaUrl: 'https://example.com/image.png',
    senderId: 'user',
    createdAt: 1,
  };
  assert.equal(displayMedia(m).type, 'image');
  for (const patch of [
    { deletedAt: 2 },
    { ciphertext: 'opaque' },
    { moderationStatus: 'blocked' },
    { moderationStatus: 'blurred' },
  ])
    assert.equal(displayMedia({ ...m, ...patch }), undefined);
});
test('media preparation rejects oversized blobs before asking the server for an upload URL', async t => {
  let requested = 0;
  t.mock.method(globalThis, 'fetch', async () => ({
    blob: async () => ({ size: MAX_MEDIA_BYTES + 1 }),
  }));
  await assert.rejects(
    uploadMedia({ uri: 'blob:local', type: 'image', mime: 'image/png' }, async () => {
      requested++;
      return 'https://example.com/upload';
    }),
  );
  assert.equal(requested, 0);
});
test('media retry retains the uploaded object, reply target and one send identifier', async () => {
  const calls = [];
  let state = [];
  const outbox = createOutbox(
    async draft => {
      calls.push(draft);
      throw new Error('uncertain');
    },
    () => 'media-key',
    v => (state = v),
  );
  outbox.enqueueMedia(
    {
      uri: 'file:local',
      type: 'image',
      mime: 'image/png',
      storageId: 'canonical-storage',
      size: 10,
    },
    'caption',
    { id: 'parent', deleted: false },
  );
  await new Promise(resolve => setImmediate(resolve));
  outbox.retry('media-key');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state[0].status, 'failed');
  assert.deepEqual(calls[1].media, calls[0].media);
  assert.equal(calls[1].id, calls[0].id);
  assert.equal(calls[1].reply.id, 'parent');
});

test('double ticks need real delivery; blue ticks need shared reads from every original recipient', () => {
  assert.equal(deliveryState(100), 'sent');
  assert.equal(deliveryState(100, undefined, 99), 'sent');
  assert.equal(deliveryState(100, undefined, 100), 'delivered');
  assert.equal(deliveryState(100, 100), 'read');
  assert.equal(deliveryState(100, 200, 200, []), 'sent');
  assert.equal(
    deliveryState(100, undefined, undefined, [
      { joinedAt: 1, readAt: 100 },
      { joinedAt: 1, deliveredAt: 100 },
      { joinedAt: 101 },
    ]),
    'delivered',
  );
  assert.equal(
    deliveryState(100, undefined, undefined, [{ joinedAt: 1, readAt: 100 }, { joinedAt: 1 }]),
    'sent',
  );
});
test('failed outgoing replies retry the same command and reconcile even after a lost acknowledgement', async () => {
  const calls = [];
  let state = [];
  let finish;
  const outbox = createOutbox(
    draft => {
      calls.push(draft);
      return new Promise((resolve, reject) => {
        finish = { resolve, reject };
      });
    },
    () => 'stable-id',
    value => (state = value),
    () => 100,
  );
  outbox.enqueue(' hello ', { id: 'parent', body: 'quoted', deleted: false });
  assert.equal(state[0].status, 'pending');
  outbox.retry('stable-id');
  assert.equal(calls.length, 1);
  finish.reject(new Error('uncertain'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state[0].status, 'failed');
  outbox.retry('stable-id');
  assert.equal(calls[1].id, calls[0].id);
  assert.equal(calls[1].reply.id, 'parent');
  outbox.acknowledge(['stable-id']);
  finish.resolve('stored');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(state, []);
});

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
