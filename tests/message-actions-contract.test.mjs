import test from 'node:test';
import assert from 'node:assert/strict';
import { getFunctionName } from 'convex/server';
import { dziriApi } from '../src/dziri/api.ts';
import {
  messageActionAvailability,
  editedMessageText,
} from '../src/dziri/message-action-policy.generated.ts';

test('standalone edits/removals address the same authenticated functions as Consumer', () => {
  assert.equal(getFunctionName(dziriApi.editMessage), 'messaging/messages:editMessage');
  assert.equal(getFunctionName(dziriApi.deleteMessage), 'messaging/messages:deleteMessage');
  assert.equal(getFunctionName(dziriApi.commerceEdit), 'marketplaceMessages:editMessage');
  assert.equal(getFunctionName(dziriApi.commerceDelete), 'marketplaceMessages:deleteMessage');
});

test('seller-side appearance cannot substitute for sender ownership and agreements remain immutable', () => {
  const message = { mine: false, type: 'text', body: 'Peer staff reply', createdAt: 100 };
  assert.equal(messageActionAvailability(message, 200).edit, false);
  assert.equal(messageActionAvailability(message, 200).remove, false);
  assert.equal(
    messageActionAvailability({ ...message, mine: true, immutable: true }, 200).remove,
    false,
  );
  assert.equal(editedMessageText('  مرحبا 👋  ', 'Old'), 'مرحبا 👋');
  assert.equal(editedMessageText('x'.repeat(8001), 'Old'), null);
});
