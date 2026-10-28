import test from 'node:test';
import assert from 'node:assert/strict';
import { InboxClient } from '../src/inbox/client.ts';
const workspace = () => ({
  version: 1,
  observationId: 'synthetic-observation-1',
  actorId: 'alice',
  companyId: 'company',
  tenantId: 'tenant',
  origin: 'https://synthetic-inbox.invalid',
  remoteUserId: 80,
  accountId: 43,
  inboxId: 2,
  email: 'agent@synthetic.invalid',
  role: 'agent',
  authorityKey: 'v1:' + 'a'.repeat(64),
});
const profile = () => ({
  id: 80,
  name: 'Synthetic agent',
  email: 'agent@synthetic.invalid',
  pubsub_token: 'synthetic-pubsub',
  account_id: 44,
  accounts: [
    { id: 43, name: 'Current business', role: 'agent', status: 'active' },
    { id: 44, name: 'Other business', role: 'administrator', status: 'active' },
  ],
});
const session = {
  'access-token': 'synthetic-token',
  client: 'synthetic-device',
  uid: 'agent@synthetic.invalid',
};
const response = data =>
  new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json', ...session },
  });

test('staff client cannot request account data before validating the current provider profile', async () => {
  let calls = 0;
  const client = new InboxClient(workspace(), async () => {
    calls++;
    return response({});
  });
  client.setSession(session);
  await assert.rejects(client.conversations(43, 1, 'all'));
  assert.equal(calls, 0);
});
test('matching provider profile exposes only the canonical target account', async () => {
  const client = new InboxClient(workspace(), async () => response(profile()));
  client.setSession(session);
  const result = await client.profile();
  assert.equal(result.account_id, 43);
  assert.deepEqual(
    result.accounts.map(a => a.id),
    [43],
  );
});
test('a foreign saved identity is rejected before any network or persistence callback', () => {
  let persisted = 0;
  const client = new InboxClient(workspace(), async () => response(profile()));
  client.onSession = () => persisted++;
  assert.throws(() => client.setSession({ ...session, uid: 'other@synthetic.invalid' }));
  assert.equal(persisted, 0);
});
for (const mismatch of ['user', 'email', 'role', 'status', 'duplicate'])
  test(`provider ${mismatch} mismatch cannot activate a session`, async () => {
    let persisted = 0;
    const data = profile();
    if (mismatch === 'user') data.id = 81;
    if (mismatch === 'email') data.email = 'other@synthetic.invalid';
    if (mismatch === 'role') data.accounts[0].role = 'administrator';
    if (mismatch === 'status') data.accounts[0].status = 'suspended';
    if (mismatch === 'duplicate') data.accounts.push({ ...data.accounts[0] });
    const client = new InboxClient(workspace(), async () => response(data));
    client.onSession = () => persisted++;
    client.setSession(session);
    await assert.rejects(client.profile());
    assert.equal(persisted, 0);
    await assert.rejects(client.conversations(43, 1, 'all'));
  });
test('a validated session cannot call another company account', async () => {
  const calls = [];
  const client = new InboxClient(workspace(), async url => {
    calls.push(url);
    return response(profile());
  });
  client.setSession(session);
  await client.profile();
  await assert.rejects(client.messages(44, 1));
  assert.equal(calls.length, 1);
});
test('late token rotation cannot replace the verified session with a foreign uid', async () => {
  let calls = 0,
    persisted = 0;
  const client = new InboxClient(workspace(), async () =>
    ++calls === 1
      ? response(profile())
      : new Response('{}', { headers: { ...session, uid: 'foreign@synthetic.invalid' } }),
  );
  client.onSession = () => persisted++;
  client.setSession(session);
  await client.profile();
  assert.equal(persisted, 1);
  await assert.rejects(client.conversations(43, 1, 'all'));
  assert.equal(persisted, 1);
  await assert.rejects(client.messages(43, 1));
  assert.equal(calls, 2);
});
test('sign out closes account APIs before waiting for remote revocation', async () => {
  let finish;
  let calls = 0;
  const client = new InboxClient(workspace(), async () =>
    ++calls === 1
      ? response(profile())
      : new Promise(resolve => {
          finish = resolve;
        }),
  );
  client.setSession(session);
  await client.profile();
  const pending = client.signOut();
  await assert.rejects(client.send(43, 1, 'synthetic', false));
  assert.equal(calls, 2);
  finish(response({}));
  await pending;
});
test('MFA challenges retain the existing server flow and do not persist a session', async () => {
  const calls = [];
  let persisted = 0;
  const client = new InboxClient(workspace(), async (url, init) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
    if (calls.length === 1)
      return new Response(JSON.stringify({ mfa_required: true, mfa_token: 'synthetic-challenge' }));
    return response(url.endsWith('/api/v1/profile') ? profile() : { data: profile() });
  });
  client.onSession = () => persisted++;
  assert.equal(
    (await client.login({ email: workspace().email, password: 'synthetic' })).mfa_required,
    true,
  );
  assert.equal(persisted, 0);
  await assert.rejects(client.conversations(43, 1, 'all'));
  assert.equal(calls.length, 1);
  await client.login({ mfa_token: 'synthetic-challenge', otp_code: '123456' });
  assert.deepEqual(calls[1].body, { mfa_token: 'synthetic-challenge', otp_code: '123456' });
  assert.equal(persisted, 1);
});
test('incomplete token headers retire the session without saving mixed credentials', async () => {
  let count = 0;
  const client = new InboxClient(workspace(), async () =>
    ++count === 1
      ? response(profile())
      : new Response('{}', { headers: { 'access-token': 'partial' } }),
  );
  client.setSession(session);
  await client.profile();
  await assert.rejects(client.messages(43, 1));
  await assert.rejects(client.messages(43, 1));
  assert.equal(count, 2);
});
test('untrusted conversation ids cannot escape the authorized account route', async () => {
  let calls = 0;
  const client = new InboxClient(workspace(), async () => {
    calls++;
    return response(profile());
  });
  client.setSession(session);
  await client.profile();
  await assert.rejects(client.messages(43, '../../44/conversations/1'));
  await assert.rejects(client.messages(43, NaN));
  assert.equal(calls, 1);
});
