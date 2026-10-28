import type { StaffWorkspace } from '../dziri/messenger-staff.generated';
import type { Profile, Session } from './client';
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 4096 &&
  !/[\u0000-\u001f\u007f]/.test(value);
const email = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
export function boundStaffSession(scope: StaffWorkspace, value: Session) {
  if (
    !value ||
    !text(value['access-token']) ||
    !text(value.client) ||
    !text(value.uid) ||
    email(value.uid) !== scope.email
  )
    throw new Error('Staff identity does not match this Dziri workspace.');
  return { 'access-token': value['access-token'], client: value.client, uid: value.uid };
}
export function boundStaffProfile(scope: StaffWorkspace, raw: unknown): Profile {
  if (
    !object(raw) ||
    raw.id !== scope.remoteUserId ||
    email(raw.email) !== scope.email ||
    !text(raw.pubsub_token) ||
    !Array.isArray(raw.accounts)
  )
    throw new Error('Staff identity does not match this Dziri workspace.');
  const accounts = raw.accounts.filter(a => object(a) && a.id === scope.accountId);
  const account = accounts[0];
  if (accounts.length !== 1 || account.role !== scope.role || account.status !== 'active')
    throw new Error('Staff access changed. Reconnect through Dziri.');
  return {
    id: scope.remoteUserId,
    email: scope.email,
    name: typeof raw.name === 'string' ? raw.name : '',
    pubsub_token: raw.pubsub_token,
    account_id: scope.accountId,
    accounts: [
      {
        id: scope.accountId,
        name: typeof account.name === 'string' ? account.name : '',
        role: scope.role,
        status: 'active',
      },
    ],
  };
}
