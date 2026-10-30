import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { secureStorageKey } from '../dziri/config';
import { staffWorkspaceKey, type StaffWorkspace } from '../dziri/messenger-staff.generated';
import { sameHandoff, type PendingHandoff } from './handoff';

const memory = new Map<string, string>();
const writes = new Map<string, Promise<void>>();
const keyFor = (workspace: StaffWorkspace) =>
  secureStorageKey('staff-handoff-v1:' + staffWorkspaceKey(workspace));
const read = (key: string) =>
  Platform.OS === 'web' ? Promise.resolve(memory.get(key) ?? null) : SecureStore.getItemAsync(key);
// 24 SHA-256 identifiers keep the owner index below older OS-vault value limits.
const MAX_PENDING = 24;
const write = (key: string, value: string) =>
  Platform.OS === 'web'
    ? Promise.resolve(memory.set(key, value)).then(() => {})
    : SecureStore.setItemAsync(key, value);
const remove = (key: string) =>
  Platform.OS === 'web'
    ? Promise.resolve(memory.delete(key)).then(() => {})
    : SecureStore.deleteItemAsync(key);
const directoryKey = (actorId: string) => secureStorageKey('staff-handoff-owner-v1:' + actorId);
const recoveryId = (scope: string) => digestStringAsync(CryptoDigestAlgorithm.SHA256, scope);
const recoveryKey = (id: string) => 'staff-recovery.' + id;
function ownerOf(scope: string): string {
  const fields = JSON.parse(scope);
  if (
    !Array.isArray(fields) ||
    fields[0] !== 'staff-workspace-v1' ||
    typeof fields[1] !== 'string' ||
    !fields[1]
  )
    throw new Error('Pending staff sign-in unavailable');
  return fields[1];
}
function queued(key: string, work: () => Promise<void>) {
  const job = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(work);
  writes.set(key, job);
  void job
    .finally(() => {
      if (writes.get(key) === job) writes.delete(key);
    })
    .catch(() => {});
  return job;
}
async function indexFor(actorId: string): Promise<string[]> {
  if (!actorId) throw new Error('Pending staff sign-in unavailable');
  const raw = await read(directoryKey(actorId));
  const keys: unknown = raw ? JSON.parse(raw) : [];
  if (
    !Array.isArray(keys) ||
    keys.length > MAX_PENDING ||
    new Set(keys).size !== keys.length ||
    keys.some(k => typeof k !== 'string' || !/^[a-f0-9]{64}$/.test(k))
  )
    throw new Error('Pending staff sign-in unavailable');
  return keys as string[];
}
async function remember(pending: PendingHandoff) {
  const actor = ownerOf(pending.scope),
    id = await recoveryId(pending.scope),
    key = recoveryKey(id);
  return queued(directoryKey(actor), async () => {
    const keys = await indexFor(actor);
    if (!keys.includes(id) && keys.length >= MAX_PENDING)
      throw new Error('Pending staff sign-ins require review');
    const previous = await read(key);
    if (previous && !sameHandoff(JSON.parse(previous), pending))
      throw new Error('Pending staff sign-in changed');
    // Individual encrypted recovery records keep the bounded owner index small.
    await write(key, JSON.stringify(pending));
    if (!keys.includes(id)) await write(directoryKey(actor), JSON.stringify([...keys, id]));
  });
}
async function forget(pending: PendingHandoff) {
  const actor = ownerOf(pending.scope),
    id = await recoveryId(pending.scope),
    key = recoveryKey(id);
  return queued(directoryKey(actor), async () => {
    const keys = await indexFor(actor),
      raw = await read(key);
    if (raw && !sameHandoff(JSON.parse(raw), pending))
      throw new Error('Pending staff sign-in changed');
    await write(key, JSON.stringify({ state: 'cancelled', scope: pending.scope }));
    await write(directoryKey(actor), JSON.stringify(keys.filter(k => k !== id)));
    await remove(key);
  });
}
/** Discovery survives lost company authority; only the same account's recovery directory is read. */
export async function listPendingHandoffs(actorId: string): Promise<PendingHandoff[]> {
  await writes.get(directoryKey(actorId))?.catch(() => {});
  const keys = await indexFor(actorId),
    result: PendingHandoff[] = [];
  for (const id of keys) {
    const raw = await read(recoveryKey(id));
    if (!raw) throw new Error('Pending staff sign-in recovery unavailable');
    const entry = JSON.parse(raw);
    if (ownerOf(entry.scope) !== actorId || (await recoveryId(entry.scope)) !== id)
      throw new Error('Pending staff sign-in recovery unavailable');
    if (entry.state === 'cancelled') continue;
    if (entry.version !== 1 || !entry.ticket || !Number.isSafeInteger(entry.expiresAt))
      throw new Error('Pending staff sign-in recovery unavailable');
    result.push(entry);
  }
  return result;
}
function parse(value: string | null, workspace: StaffWorkspace): PendingHandoff | null {
  if (!value) return null;
  const parsed = JSON.parse(value) as PendingHandoff;
  if (
    parsed.version !== 1 ||
    parsed.scope !== staffWorkspaceKey(workspace) ||
    !Number.isSafeInteger(parsed.expiresAt) ||
    !parsed.ticket ||
    parsed.ticket.keyVersion !== 1 ||
    typeof parsed.ticket.cipher !== 'string' ||
    parsed.ticket.cipher.length > 8192 ||
    typeof parsed.ticket.iv !== 'string' ||
    !/^[A-Za-z0-9_-]{16}$/.test(parsed.ticket.iv)
  )
    throw new Error('Pending staff sign-in unavailable');
  return parsed;
}
/** Web is memory-only. Native recovery stores an already encrypted ticket in the OS vault. */
export async function loadPendingHandoff(workspace: StaffWorkspace) {
  const key = keyFor(workspace);
  await writes.get(key)?.catch(() => {});
  const stored = parse(await read(key), workspace);
  if (stored) return stored;
  const recovered = (await listPendingHandoffs(workspace.actorId)).find(
    p => p.scope === staffWorkspaceKey(workspace),
  );
  return recovered ? parse(JSON.stringify(recovered), workspace) : null;
}
/** Compare-and-set within the serialized vault operation prevents stale cleanup erasing a replacement. */
export function savePendingHandoff(
  workspace: StaffWorkspace,
  pending: PendingHandoff | null,
  expected?: PendingHandoff,
) {
  const key = keyFor(workspace);
  const job = (writes.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const current = parse(await read(key), workspace);
      if (pending) {
        if (
          pending.scope !== staffWorkspaceKey(workspace) ||
          (current && !sameHandoff(current, pending))
        )
          throw new Error('Pending staff sign-in changed');
        const value = JSON.stringify({
          version: 1,
          scope: pending.scope,
          expiresAt: pending.expiresAt,
          ticket: {
            cipher: pending.ticket.cipher,
            iv: pending.ticket.iv,
            keyVersion: pending.ticket.keyVersion,
          },
        });
        parse(value, workspace);
        await remember(JSON.parse(value));
        if (Platform.OS === 'web') memory.set(key, value);
        else await SecureStore.setItemAsync(key, value);
      } else {
        if (!expected || (current && !sameHandoff(current, expected)))
          throw new Error('Pending staff sign-in changed');
        if (Platform.OS === 'web') memory.delete(key);
        else await SecureStore.deleteItemAsync(key);
        await forget(expected);
      }
    });
  writes.set(key, job);
  void job
    .finally(() => {
      if (writes.get(key) === job) writes.delete(key);
    })
    .catch(() => {});
  return job;
}
