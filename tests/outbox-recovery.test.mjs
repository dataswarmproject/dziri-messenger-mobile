import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutbox } from '../src/dziri/outbox.ts';
test('restored commands require explicit retry and persistence finishes before transport', async () => {
  const events = [],
    transmitted = [];
  let release;
  const wait = new Promise(resolve => {
    release = resolve;
  });
  const outbox = createOutbox(
    async row => {
      transmitted.push(row);
      events.push('send');
    },
    () => 'new',
    () => {},
    Date.now,
    async () => {
      events.push('save');
      await wait;
    },
  );
  outbox.restore([
    {
      id: 'old',
      body: 'Body',
      createdAt: Date.now(),
      status: 'pending',
      reply: { id: 'parent', deleted: false },
    },
  ]);
  assert.deepEqual(transmitted, []);
  outbox.retry('old');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, ['save']);
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(transmitted[0].id, 'old');
  assert.equal(transmitted[0].reply.id, 'parent');
});
test('failed local persistence never reaches the network and confirmation cannot be resurrected', async () => {
  const sent = [],
    visible = [];
  const outbox = createOutbox(
    async row => sent.push(row),
    () => 'stable',
    rows => visible.push(rows),
    Date.now,
    async () => {
      throw new Error('Storage full');
    },
  );
  outbox.enqueue('Keep me');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.length, 0);
  assert.equal(visible.at(-1)[0].status, 'failed');
  outbox.acknowledge(['stable']);
  outbox.retry('stable');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(visible.at(-1), []);
});

test('suspension cancels storage-waiting dispatch; resuming needs explicit retry with the original command', async () => {
  let release;
  const barrier = new Promise(resolve => {
      release = resolve;
    }),
    sent = [],
    visible = [];
  const box = createOutbox(
    async row => sent.push(row),
    () => 'retained-command',
    rows => visible.push(rows),
    () => 10,
    async () => barrier,
  );
  box.enqueue('Retained', { id: 'parent', body: 'Original quote', deleted: false });
  box.deactivate();
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sent, []);
  assert.equal(box.enqueue('Must not send'), false);
  assert.equal(box.enqueueMedia({ type: 'image' }, ''), false);
  assert.equal(box.enqueueSticker({ id: 'sticker', uri: 'https://example.test/s' }), false);
  box.activate();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sent, []);
  assert.equal(visible.at(-1)[0].status, 'failed');
  box.retry('retained-command');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].id, 'retained-command');
  assert.equal(sent[0].reply.id, 'parent');
});
test('an old transport response cannot overwrite or release a resumed attempt', async () => {
  const resolvers = [],
    visible = [];
  const box = createOutbox(
    () => new Promise((resolve, reject) => resolvers.push({ resolve, reject })),
    () => 'same-id',
    rows => visible.push(rows),
  );
  box.enqueue('Same immutable payload');
  box.deactivate();
  box.activate();
  box.retry('same-id');
  assert.equal(resolvers.length, 2);
  const count = visible.length;
  resolvers[0].reject(new Error('Old connection failed'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(visible.length, count);
  assert.equal(visible.at(-1)[0].status, 'pending');
  box.retry('same-id');
  assert.equal(resolvers.length, 2);
  resolvers[1].resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(visible.at(-1)[0].status, 'sent');
});
test('suspended completion cannot persist or publish a late success', async () => {
  let resolve;
  const visible = [],
    box = createOutbox(
      () =>
        new Promise(done => {
          resolve = done;
        }),
      () => 'active-id',
      rows => visible.push(rows),
    );
  box.enqueue('Sent before leaving');
  box.deactivate();
  const count = visible.length;
  resolve();
  await new Promise(done => setImmediate(done));
  assert.equal(visible.length, count);
});
