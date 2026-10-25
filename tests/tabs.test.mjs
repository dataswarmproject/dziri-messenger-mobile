import test from 'node:test';
import assert from 'node:assert/strict';
import { messengerTabs, activeMessengerTab, messengerScopeKey } from '../src/messenger-policy.ts';
import { inboxSessionScope } from '../src/inbox/session-key.ts';
import { consumerTypeface } from '../src/dziri/typeface.ts';

test('Arabic UI and mixed Arabic text use Consumer’s thmanyah face at the intended weight', () => {
  assert.equal(consumerTypeface({ rtl: true, family: 'Inter-500-24' }), 'thmanyahsans-Medium');
  assert.equal(consumerTypeface({ rtl: true, weight: '600' }), 'thmanyahsans-Bold');
  assert.equal(consumerTypeface({ rtl: false, text: 'محادثة' }), 'thmanyahsans-Regular');
  assert.equal(
    consumerTypeface({ rtl: false, family: 'Inter-500-24', text: 'Français' }),
    'Inter-500-24',
  );
});

test('Staff credentials cannot be restored under another Dziri user or Inbox origin', () => {
  const first = inboxSessionScope('https://inbox.example.test', 'user-one');
  assert.notEqual(first, inboxSessionScope('https://inbox.example.test', 'user-two'));
  assert.notEqual(first, inboxSessionScope('https://other.example.test', 'user-one'));
  assert.notEqual(first, inboxSessionScope('https://inbox.example.test', ''));
});

const business = { id: 'company', name: 'Business', role: 'editor' };
const store = { id: 'shop', name: 'Shop' };
test('Friends is always present; business tabs require confirmed server eligibility', () => {
  for (const value of [
    undefined,
    null,
    { staff: false, customers: false, businesses: [], stores: [] },
  ])
    assert.deepEqual(messengerTabs(value), ['friends']);
  assert.deepEqual(
    messengerTabs({ staff: true, customers: false, businesses: [business], stores: [] }),
    ['friends', 'staff'],
  );
  assert.deepEqual(
    messengerTabs({ staff: true, customers: true, businesses: [business], stores: [store] }),
    ['friends', 'customers', 'staff'],
  );
  assert.deepEqual(messengerTabs({ staff: true, customers: true, businesses: [], stores: [] }), [
    'friends',
  ]);
});
test('Revocation or an unknown account state immediately falls back to Friends', () => {
  assert.equal(activeMessengerTab('customers', null), 'friends');
  assert.equal(
    activeMessengerTab('staff', { staff: false, customers: false, businesses: [], stores: [] }),
    'friends',
  );
  assert.equal(
    activeMessengerTab('staff', {
      staff: true,
      customers: false,
      businesses: [business],
      stores: [],
    }),
    'staff',
  );
});
test('Account or tenant changes invalidate an open business conversation', () => {
  const state = { staff: true, customers: true, businesses: [business], stores: [store] };
  assert.notEqual(
    messengerScopeKey('one', 'staff', state),
    messengerScopeKey('two', 'staff', state),
  );
  assert.notEqual(
    messengerScopeKey('one', 'staff', state),
    messengerScopeKey('one', 'staff', { ...state, businesses: [] }),
  );
  assert.notEqual(
    messengerScopeKey('one', 'customers', state),
    messengerScopeKey('one', 'customers', { ...state, stores: [] }),
  );
});
