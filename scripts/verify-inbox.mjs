import assert from 'node:assert/strict';
import { InboxClient } from '../src/inbox/client.ts';

// Opt-in real-server contract check. Mutates only a named local demo conversation.
const origin = new URL(process.env.DZIRI_INBOX_TEST_URL ?? 'http://localhost:3901');
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname),
  'Verification is restricted to the local demo',
);
assert.ok(
  process.env.DZIRI_INBOX_TEST_EMAIL && process.env.DZIRI_INBOX_TEST_PASSWORD,
  'Set local demo credentials in the test environment',
);
const conversation = Number(process.env.DZIRI_INBOX_TEST_CONVERSATION);
assert.ok(
  Number.isSafeInteger(conversation) && conversation > 0,
  'Select the local demo conversation explicitly',
);
const client = new InboxClient(origin.origin);
try {
  const login = await client.login({
    email: process.env.DZIRI_INBOX_TEST_EMAIL,
    password: process.env.DZIRI_INBOX_TEST_PASSWORD,
  });
  assert.ok(login.data);
  const profile = await client.profile();
  const account = profile.account_id;
  assert.ok(profile.accounts.some(item => item.id === account && item.status === 'active'));
  const list = await client.conversations(account, 1, 'all');
  assert.ok(
    list.data.payload.some(item => item.id === conversation),
    'Selected conversation must belong to this staff account',
  );
  const before = await client.conversation(account, conversation);
  const marker = `Mobile contract check ${Date.now()}`;
  const message = await client.send(account, conversation, marker, true);
  assert.equal(message.private, true);
  const history = await client.messages(account, conversation);
  assert.ok(
    history.payload.some(item => item.id === message.id && item.content === marker && item.private),
  );
  await client.status(account, conversation, before.status === 'resolved' ? 'open' : 'resolved');
  assert.notEqual((await client.conversation(account, conversation)).status, before.status);
  await client.status(account, conversation, before.status);
  await client.assign(account, conversation, profile.id);
  assert.equal((await client.conversation(account, conversation)).meta.assignee.id, profile.id);
  await client.assign(account, conversation, before.meta.assignee?.id ?? null);
  await assert.rejects(client.conversations(2147483647, 1, 'all'));
  await client.signOut();
  await assert.rejects(client.profile());
  console.log(
    'Real local Inbox contract passed: staff login, profile, queues, canonical messages, private notes, status, assignment, account isolation, session revocation.',
  );
} finally {
  client.dispose();
}
