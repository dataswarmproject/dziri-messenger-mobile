import test from 'node:test';
import assert from 'node:assert/strict';
import { messageGroups } from '../src/dziri/message-groups.ts';

test('descending message history joins adjacent messages from the same author in chronological order', () => {
  const at = new Date(2026, 9, 27, 12).getTime();
  const rows = [0, 1, 2].map(i => ({ senderId: 'same-person', createdAt: at - i * 10_000 }));
  assert.deepEqual(messageGroups(rows, 0), { before: true, after: false });
  assert.deepEqual(messageGroups(rows, 1), { before: true, after: true });
  assert.deepEqual(messageGroups(rows, 2), { before: false, after: true });
});

test('author changes, deleted/local messages, long gaps and midnight break grouping', () => {
  const midnight = new Date(2026, 9, 27, 0, 0, 0).getTime();
  const current = { senderId: 'me', createdAt: midnight + 60_000 };
  for (const older of [
    { ...current, senderId: 'peer' },
    { ...current, deleted: true },
    { ...current, local: true },
    { ...current, createdAt: current.createdAt - 300_000 },
    { ...current, createdAt: midnight - 1 },
  ])
    assert.equal(messageGroups([current, older], 0).before, false);
});
