import test from 'node:test';
import assert from 'node:assert/strict';
import { supportLink, staffRole } from '../src/access.ts';

test('Support links identify a customer destination, never permissions or consent', () => {
  assert.deepEqual(supportLink('https://dziri.app/support/company123'), {
    companyId: 'company123',
  });
  assert.deepEqual(supportLink('dziri-messenger://support/company123'), {
    companyId: 'company123',
  });
  for (const url of [
    'https://dziri.app.evil.example/support/company123',
    'https://evil.example/support/company123',
    'http://dziri.app/support/company123',
    'https://user:secret@dziri.app/support/company123',
    'dziri-messenger://staff?role=administrator',
    'https://dziri.app/support/company123?consent=true',
    'https://dziri.app/support/company123/extra',
  ])
    assert.equal(supportLink(url), null);
});

test('Only active server-returned staff memberships select a team role', () => {
  assert.equal(staffRole({ role: 'administrator', status: 'active' }), 'administrator');
  assert.equal(staffRole({ role: 'agent', status: 'active' }), 'agent');
  assert.equal(staffRole({ role: 'agent', status: 'suspended' }), null);
  assert.equal(staffRole({ role: 'customer', status: 'active' }), null);
  assert.equal(staffRole({ role: 'viewer', status: 'active' }), null);
});
