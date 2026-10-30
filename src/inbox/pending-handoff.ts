import type { PendingHandoff } from './handoff';
export function staffHandoffOwner(scope: string): string {
  if (typeof scope !== 'string' || scope.length > 4096)
    throw new Error('Pending staff sign-in unavailable');
  const fields = JSON.parse(scope);
  if (
    !Array.isArray(fields) ||
    fields.length !== 10 ||
    JSON.stringify(fields) !== scope ||
    fields[0] !== 'staff-workspace-v1' ||
    ![1, 2, 3, 4, 8, 9].every(i => typeof fields[i] === 'string' && fields[i]) ||
    ![5, 6, 7].every(i => Number.isSafeInteger(fields[i]) && fields[i] > 0) ||
    !['agent', 'administrator'].includes(fields[8]) ||
    !/^v1:[a-f0-9]{64}$/.test(fields[9])
  )
    throw new Error('Pending staff sign-in unavailable');
  const origin = new URL(fields[4]);
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== fields[4] ||
    origin.username ||
    origin.password
  )
    throw new Error('Pending staff sign-in unavailable');
  return fields[1];
}
export function parsePendingHandoff(value: string | null, scope: string): PendingHandoff | null {
  if (!value) return null;
  if (value.length > 32768) throw new Error('Pending staff sign-in unavailable');
  staffHandoffOwner(scope);
  const parsed = JSON.parse(value) as PendingHandoff;
  if (
    !parsed ||
    parsed.version !== 1 ||
    parsed.scope !== scope ||
    !Number.isSafeInteger(parsed.expiresAt) ||
    parsed.expiresAt <= 0 ||
    parsed.expiresAt > 8.64e15 ||
    !parsed.ticket ||
    parsed.ticket.keyVersion !== 1 ||
    typeof parsed.ticket.cipher !== 'string' ||
    !parsed.ticket.cipher ||
    parsed.ticket.cipher.length > 8192 ||
    typeof parsed.ticket.iv !== 'string' ||
    !/^[A-Za-z0-9_-]{16}$/.test(parsed.ticket.iv)
  )
    throw new Error('Pending staff sign-in unavailable');
  return {
    version: 1,
    scope,
    expiresAt: parsed.expiresAt,
    ticket: {
      cipher: parsed.ticket.cipher,
      iv: parsed.ticket.iv,
      keyVersion: 1,
    },
  };
}
