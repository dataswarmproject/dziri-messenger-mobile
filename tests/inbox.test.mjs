import test from 'node:test';
import assert from 'node:assert/strict';
import { InboxClient, inboxOrigin, mergeMessages } from '../src/inbox/client.ts';
const workspace = () => ({
  version: 1,
  observationId: 'synthetic-observation-1',
  actorId: 'alice',
  companyId: 'company',
  tenantId: 'tenant',
  origin: 'https://inbox.example.com',
  remoteUserId: 80,
  accountId: 43,
  inboxId: 2,
  email: 'agent@example.com',
  role: 'agent',
  authorityKey: 'v1:' + 'a'.repeat(64),
});
const saved = {
  'access-token': 'first',
  client: `dziri-staff:${'0123456789abcdef'.repeat(3)}`,
  uid: 'agent@example.com',
};
const profile = () => ({
  id: 80,
  name: 'Synthetic agent',
  email: saved.uid,
  pubsub_token: 'synthetic-pubsub',
  accounts: [{ id: 43, name: 'Business', role: 'agent', status: 'active' }],
});

test('Browser fetch keeps its platform receiver', async () => {
  const client = new InboxClient(workspace(), function () {
    assert.equal(this, globalThis);
    return Promise.resolve(new Response(JSON.stringify(profile())));
  });
  client.setSession(saved);
  await client.profile();
});

test('Inbox origins exclude credentials and paths; local development is explicit', () => {
  assert.equal(inboxOrigin('https://inbox.dziri.app/'), 'https://inbox.dziri.app');
  for (const url of [
    'https://user:pass@example.com',
    'https://example.com/api',
    'http://example.com',
  ]) {
    assert.throws(() => inboxOrigin(url));
  }
  assert.throws(() => inboxOrigin('http://localhost:3901'));
  assert.equal(inboxOrigin('http://localhost:3901', true), 'http://localhost:3901');
});

test('Staff authentication uses the existing server session; rotated tokens replace old ones', async () => {
  const calls = [];
  const session = { 'access-token': 'first', client: saved.client, uid: 'agent@example.com' };
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify(url.endsWith('/api/v1/profile') ? profile() : { payload: [] }),
      {
        headers: {
          'content-type': 'application/json',
          'access-token': 'rotated',
          client: saved.client,
          uid: session.uid,
        },
      },
    );
  };
  const client = new InboxClient(workspace(), fetcher);
  client.setSession(session);
  await client.profile();
  await client.conversations(43, 1, 'all');
  await client.messages(43, 7);
  assert.equal(calls[0].init.headers['access-token'], 'first');
  assert.equal(calls[1].init.headers['access-token'], 'rotated');
  assert.match(calls[1].url, /api\/v1\/accounts\/43\/conversations\?/);
  assert.match(calls[2].url, /accounts\/43\/conversations\/7\/messages/);
});

test('Replies and notes use the same server messages with explicit visibility', async () => {
  const calls = [];
  const client = new InboxClient(workspace(), async (url, init) => {
    if (url.endsWith('/api/v1/profile')) return new Response(JSON.stringify(profile()));
    calls.push(JSON.parse(init.body));
    return new Response('{}');
  });
  client.setSession(saved);
  await client.profile();
  await client.send(43, 7, 'Reply', false);
  await client.send(43, 7, 'Staff only', true);
  assert.deepEqual(calls, [
    { content: 'Reply', message_type: 'outgoing', private: false },
    { content: 'Staff only', message_type: 'outgoing', private: true },
  ]);
});

test('History refresh preserves older pages and replaces edited/deleted messages', () => {
  const history = [
    { id: 1, content: 'old' },
    { id: 2, content: 'before' },
  ];
  const updated = mergeMessages(history, [
    { id: 2, content: 'after' },
    { id: 3, content: 'new' },
  ]);
  assert.deepEqual(
    updated.map(m => m.content),
    ['old', 'after', 'new'],
  );
});

test('Disposing a session aborts in-flight work and prevents future requests', async () => {
  let signal;
  const client = new InboxClient(workspace(), async (_url, init) => {
    signal = init.signal;
    return new Promise((resolve, reject) =>
      signal.addEventListener('abort', () => reject(new Error('aborted'))),
    );
  });
  client.setSession(saved);
  const request = client.profile();
  client.dispose();
  await assert.rejects(request, /aborted/);
  assert.equal(signal.aborted, true);
  await assert.rejects(client.profile(), /closed/);
});
