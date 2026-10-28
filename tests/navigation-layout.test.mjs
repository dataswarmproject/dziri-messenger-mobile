import test from 'node:test';
import assert from 'node:assert/strict';
import { messengerWorkspace, newConversationTarget } from '../src/dziri/workspace-layout.ts';
test('phone stacks remain focused and desktop conversations match the Consumer split widths', () => {
  for (const width of [320, 375, 430, 1023])
    assert.equal(messengerWorkspace(width, 'Conversation').split, false);
  assert.deepEqual(messengerWorkspace(1024, 'Conversation'), { split: true, sidebarWidth: 340 });
  assert.deepEqual(messengerWorkspace(1280, 'Chats'), { split: true, sidebarWidth: 380 });
  assert.equal(messengerWorkspace(1280, 'Settings').split, false);
  assert.equal(messengerWorkspace(1280, 'Conversation', true).split, false);
});
test('new conversations start in their own domain, never through a staff credential shortcut', () => {
  assert.equal(newConversationTarget('friends'), 'friends');
  assert.equal(newConversationTarget('marketplace'), 'businesses');
  assert.equal(newConversationTarget('staff'), 'staffInbox');
});
