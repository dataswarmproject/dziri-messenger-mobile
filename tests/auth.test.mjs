import test from 'node:test';
import assert from 'node:assert/strict';
import { authRequest, AuthInputError, authErrorReason } from '../src/dziri/auth-request.ts';
const fields = {
  email: ' User@Example.com ',
  password: 'Unique unbreached phrase 35!',
  confirmation: 'Unique unbreached phrase 35!',
  name: '  Dziri User ',
  code: '123456',
  agreed: true,
};
test('Consumer registration uses canonical password flow and requires explicit consent', () => {
  assert.deepEqual(authRequest('signUp', fields), {
    flow: 'signUp',
    email: 'user@example.com',
    name: 'Dziri User',
    password: fields.password,
  });
  assert.throws(
    () => authRequest('signUp', { ...fields, agreed: false }),
    e => e instanceof AuthInputError && e.reason === 'consent',
  );
  assert.throws(
    () => authRequest('signUp', { ...fields, confirmation: 'different' }),
    e => e.reason === 'mismatch',
  );
});
test('Existing account passwords remain valid; new credentials follow Consumer policy', () => {
  assert.equal(authRequest('signIn', { ...fields, password: 'old' }).password, 'old');
  for (const password of ['short', 'a'.repeat(129), 'long password\u0000value'])
    assert.throws(
      () => authRequest('signUp', { ...fields, password, confirmation: password }),
      e => e.reason === 'length',
    );
});
test('Recovery requests and verification share Consumer SMS provider without actor IDs', () => {
  assert.deepEqual(authRequest('reset', fields), {
    flow: 'reset',
    email: 'user@example.com',
    recoveryChannel: 'sms',
  });
  assert.deepEqual(authRequest('reset-verification', fields), {
    flow: 'reset-verification',
    email: 'user@example.com',
    recoveryChannel: 'sms',
    code: '123456',
    newPassword: fields.password,
  });
  assert.throws(
    () => authRequest('reset-verification', { ...fields, code: '12345' }),
    e => e.reason === 'code',
  );
});
test('Provider errors expose safe messages rather than credentials or arbitrary server output', () => {
  assert.equal(authErrorReason(new Error('PASSWORD_BREACHED')), 'breached');
  assert.equal(authErrorReason(new Error('PASSWORD_CHECK_UNAVAILABLE')), 'unavailable');
  assert.equal(authErrorReason(new Error('Invalid or expired password reset code')), 'code');
  assert.equal(authErrorReason(new Error('private provider details')), 'generic');
});
