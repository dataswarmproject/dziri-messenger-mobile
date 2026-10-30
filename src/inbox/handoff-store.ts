import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { secureStorageKey } from '../dziri/config';
import { staffWorkspaceKey, type StaffWorkspace } from '../dziri/messenger-staff.generated';
import { sameHandoff, type PendingHandoff } from './handoff';
import { staffHandoffOwner as ownerOf, parsePendingHandoff as parse } from './pending-handoff';

const memory = new Map<string, string>();
const writes = new Map<string, Promise<void>>();
const keyForScope = (scope: string) => secureStorageKey('staff-handoff-v1:' + scope);
const keyFor = (workspace: StaffWorkspace) => keyForScope(staffWorkspaceKey(workspace));
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
const retired = (entry: Record<string, unknown>, scope: string) =>
  entry?.state === 'cancelled' && entry.scope === scope;
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
    if (previous) {
      const entry = JSON.parse(previous);
      if (!retired(entry, pending.scope) && !sameHandoff(entry, pending))
        throw new Error('Pending staff sign-in changed');
    }
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
    if (raw) {
      const entry = JSON.parse(raw);
      if (!retired(entry, pending.scope) && !sameHandoff(entry, pending))
        throw new Error('Pending staff sign-in changed');
    }
    await write(key, JSON.stringify({ ...pending, state: 'cancelled' }));
    await write(directoryKey(actor), JSON.stringify(keys.filter(k => k !== id)));
    await remove(key);
  });
}
/** Discovery survives lost company authority; only the same account's recovery directory is read. */
export async function listPendingHandoffs(actorId: string): Promise<PendingHandoff[]> {
  await writes.get(directoryKey(actorId))?.catch(() => {});
  const keys = await indexFor(actorId),
    result: PendingHandoff[] = [],
    completed = new Map<string, string>();
  for (const id of keys) {
    const raw = await read(recoveryKey(id));
    if (!raw) throw new Error('Pending staff sign-in recovery unavailable');
    const entry = JSON.parse(raw);
    if (ownerOf(entry.scope) !== actorId || (await recoveryId(entry.scope)) !== id)
      throw new Error('Pending staff sign-in recovery unavailable');
    if (entry.state === 'cancelled') {
      completed.set(id, raw);
      continue;
    }
    result.push(parse(raw, entry.scope)!);
  }
  if (completed.size)
    await queued(directoryKey(actorId), async () => {
      const current = await indexFor(actorId),
        removable = new Set<string>();
      for (const [id, marker] of completed)
        if (current.includes(id) && (await read(recoveryKey(id))) === marker) removable.add(id);
      if (!removable.size) return;
      // The marker already proves confirmed cancellation. Retire the index first;
      // a failed record deletion must not leave a dangling directory entry.
      await write(directoryKey(actorId), JSON.stringify(current.filter(id => !removable.has(id))));
      for (const id of removable) await remove(recoveryKey(id));
    });
  return result;
}
/** Web is memory-only. Native recovery stores an already encrypted ticket in the OS vault. */
export async function loadPendingHandoff(workspace: StaffWorkspace) {
  const key = keyFor(workspace);
  await writes.get(key)?.catch(() => {});
  const stored = parse(await read(key), staffWorkspaceKey(workspace));
  if (stored) return stored;
  const recovered = (await listPendingHandoffs(workspace.actorId)).find(
    p => p.scope === staffWorkspaceKey(workspace),
  );
  return recovered ?? null;
}

/** Only after server-confirmed cancellation. No current business descriptor is needed. */
export async function clearRecoveredHandoff(actorId: string, expected: PendingHandoff) {
  const captured = parse(JSON.stringify(expected), expected.scope);
  if (!captured || ownerOf(captured.scope) !== actorId)
    throw new Error('Pending staff sign-in unavailable');
  const key = keyForScope(captured.scope);
  return queued(key, async () => {
    const current = parse(await read(key), captured.scope);
    if (current && !sameHandoff(current, captured))
      throw new Error('Pending staff sign-in changed');
    // Check both copies before removing either, including interrupted scope writes.
    const raw = await read(recoveryKey(await recoveryId(captured.scope)));
    if (raw) {
      const entry = JSON.parse(raw);
      if (!retired(entry, captured.scope) && !sameHandoff(entry, captured))
        throw new Error('Pending staff sign-in changed');
    }
    await remove(key);
    await forget(captured);
  });
}
/** Compare-and-set within the serialized vault operation prevents stale cleanup erasing a replacement. */
export function savePendingHandoff(
  workspace: StaffWorkspace,
  pending: PendingHandoff | null,
  expected?: PendingHandoff,
) {
  if (!pending) {
    if (!expected || expected.scope !== staffWorkspaceKey(workspace))
      return Promise.reject(new Error('Pending staff sign-in changed'));
    return clearRecoveredHandoff(workspace.actorId, expected);
  }
  const key = keyFor(workspace);
  return queued(key, async () => {
    const current = parse(await read(key), staffWorkspaceKey(workspace));
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
    parse(value, staffWorkspaceKey(workspace));
    await remember(JSON.parse(value));
    if (Platform.OS === 'web') memory.set(key, value);
    else await SecureStore.setItemAsync(key, value);
  });
}
