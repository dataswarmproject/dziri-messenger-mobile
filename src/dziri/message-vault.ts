import { outgoingIntentKey, type OutgoingDraft } from './outbox.ts';
import { copyMarketplaceWriteScope, copyPersonalWriteScope } from './message-writes.generated.ts';

export type SavedConversation = { body: string; pending: OutgoingDraft[] };
type RemovedCommand = { id: string; createdAt: number };
type Journal = SavedConversation & { scope: string; updatedAt: number; removed: RemovedCommand[] };
export type VaultIO = {
  read: () => Promise<string | null>;
  write: (ciphertext: string) => Promise<unknown>;
  remove: () => Promise<unknown>;
  seal: (plaintext: string) => Promise<string>;
  open: (ciphertext: string) => Promise<string>;
};
const RETENTION = 86400000;
const empty = (): SavedConversation => ({ body: '', pending: [] });
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function checkedRemoved(value: unknown, now: number): RemovedCommand[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 400) throw new Error('Invalid local removal records');
  const seen = new Set<string>();
  return value.filter((row): row is RemovedCommand => {
    if (
      !row ||
      typeof row.id !== 'string' ||
      !row.id ||
      row.id.length > 128 ||
      seen.has(row.id) ||
      !Number.isFinite(row.createdAt)
    )
      throw new Error('Invalid local removal record');
    seen.add(row.id);
    return row.createdAt <= now && now - row.createdAt < RETENTION;
  });
}

function checkedPending(value: unknown, now: number): OutgoingDraft[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('Invalid local queue');
  const seen = new Set<string>();
  return value.filter((row): row is OutgoingDraft => {
    if (
      !row ||
      typeof row !== 'object' ||
      typeof row.id !== 'string' ||
      row.id.length > 128 ||
      !row.id ||
      seen.has(row.id) ||
      typeof row.body !== 'string' ||
      row.body.length > 8000 ||
      !Number.isFinite(row.createdAt) ||
      !['pending', 'sent', 'failed'].includes(row.status)
    )
      throw new Error('Invalid local queue');
    seen.add(row.id);
    if (
      row.reply &&
      (typeof row.reply.id !== 'string' ||
        (row.reply.body !== undefined &&
          (typeof row.reply.body !== 'string' || row.reply.body.length > 8000)))
    )
      throw new Error('Invalid reply');
    if (
      row.media &&
      (typeof row.media.storageId !== 'string' ||
        typeof row.media.uri !== 'string' ||
        !['image', 'voice', 'video', 'file'].includes(row.media.type) ||
        typeof row.media.mime !== 'string' ||
        (row.media.name !== undefined &&
          (typeof row.media.name !== 'string' || row.media.name.length > 255)) ||
        !Number.isFinite(row.media.size))
    )
      throw new Error('Invalid media');
    if (row.sticker && (typeof row.sticker.id !== 'string' || typeof row.sticker.uri !== 'string'))
      throw new Error('Invalid expression');
    if (row.marketplaceScope !== undefined) copyMarketplaceWriteScope(row.marketplaceScope);
    if (row.personalScope !== undefined) copyPersonalWriteScope(row.personalScope);
    if (row.marketplaceScope !== undefined && row.personalScope !== undefined)
      throw new Error('Ambiguous captured messaging access');
    return row.status !== 'sent' && row.createdAt <= now && now - row.createdAt < RETENTION;
  });
}

/** Serialized encrypted account journal. No restored command is automatically sent. */
export function createMessageVault(io: VaultIO, now = Date.now) {
  let journals: Journal[] | null = null;
  let closed = false;
  let queue = Promise.resolve();
  function run<T>(action: () => Promise<T>): Promise<T> {
    const next = queue.then(action);
    queue = next.then(
      () => {},
      () => {},
    );
    return next;
  }
  async function load() {
    if (closed) throw new Error('Local session closed');
    if (journals) return journals;
    const ciphertext = await io.read();
    if (!ciphertext) return (journals = []);
    if (ciphertext.length > 600000) throw new Error('Invalid local data');
    const data: unknown = JSON.parse(await io.open(ciphertext));
    if (
      !data ||
      typeof data !== 'object' ||
      !('version' in data) ||
      data.version !== 1 ||
      !('journals' in data) ||
      !Array.isArray(data.journals) ||
      data.journals.length > 20
    )
      throw new Error('Invalid local data');
    const at = now();
    journals = data.journals
      .map(row => {
        if (
          !row ||
          typeof row.scope !== 'string' ||
          row.scope.length > 500 ||
          typeof row.body !== 'string' ||
          row.body.length > 8000 ||
          !Number.isFinite(row.updatedAt)
        )
          throw new Error('Invalid local data');
        const removed = checkedRemoved(row.removed, at),
          ids = new Set(removed.map(row => row.id));
        return {
          scope: row.scope,
          body: row.body,
          updatedAt: row.updatedAt,
          pending: checkedPending(row.pending, at).filter(row => !ids.has(row.id)),
          removed,
        };
      })
      .filter(row => row.updatedAt <= at && at - row.updatedAt < RETENTION);
    return journals;
  }
  async function persist(next: Journal[], verify = false) {
    const plaintext = JSON.stringify({
      version: 1,
      journals: next.map(({ removed, ...row }) => (removed.length ? { ...row, removed } : row)),
    });
    if (plaintext.length > 300000) throw new Error('Local storage capacity reached');
    const sealed = await io.seal(plaintext);
    await io.write(sealed);
    if (verify && (await io.read()) !== sealed)
      throw new Error('Local removal could not be confirmed');
    journals = copy(next);
  }
  return {
    read(scope: string) {
      return run(async () => {
        const journal = (await load()).find(row => row.scope === scope);
        return journal && now() - journal.updatedAt < RETENTION
          ? copy({
              body: journal.body,
              pending: checkedPending(journal.pending, now()).map(row => ({
                ...row,
                status: 'failed' as const,
              })),
            })
          : empty();
      });
    },
    save(scope: string, patch: Partial<SavedConversation>) {
      patch = copy(patch);
      return run(async () => {
        if (!scope || scope.length > 500) throw new Error('Invalid local scope');
        const current = await load();
        const prior = current.find(row => row.scope === scope) ?? { ...empty(), removed: [] };
        const body = patch.body ?? prior.body;
        if (typeof body !== 'string' || body.length > 8000) throw new Error('Invalid draft');
        const removed = checkedRemoved(prior.removed, now()),
          ids = new Set(removed.map(row => row.id));
        const pending = checkedPending(patch.pending ?? prior.pending, now()).filter(
          row => !ids.has(row.id),
        );
        const next = [
          { scope, body, pending, removed, updatedAt: now() },
          ...current.filter(row => row.scope !== scope),
        ]
          .map(row => ({ ...row, removed: checkedRemoved(row.removed, now()) }))
          .filter(row => row.body || row.pending.length || row.removed.length);
        while (next.length > 20) {
          let index = next.length - 1;
          while (index >= 0 && (next[index].scope === scope || next[index].removed.length)) index--;
          if (index < 0) throw new Error('Local storage capacity reached');
          next.splice(index, 1);
        }
        await persist(next);
      });
    },
    removePending(scope: string, expected: OutgoingDraft) {
      expected = copy(expected);
      return run(async () => {
        if (!scope || scope.length > 500) throw new Error('Invalid local scope');
        checkedPending([expected], now());
        const current = await load(),
          journal = current.find(row => row.scope === scope),
          original = journal?.pending.find(row => row.id === expected.id);
        if (!journal || !original || outgoingIntentKey(original) !== outgoingIntentKey(expected))
          return false;
        const removed = checkedRemoved(journal.removed, now());
        if (removed.length >= 400) throw new Error('Local removal capacity reached');
        const next = current.map(row =>
          row === journal
            ? {
                ...row,
                updatedAt: now(),
                pending: row.pending.filter(row => row.id !== expected.id),
                removed: [...removed, { id: original.id, createdAt: original.createdAt }],
              }
            : row,
        );
        await persist(next, true);
        return true;
      });
    },
    clear() {
      // Reject writes scheduled after sign-out even while an older encryption finishes.
      closed = true;
      return run(async () => {
        journals = [];
        await io.remove();
      });
    },
  };
}
export type MessageVault = ReturnType<typeof createMessageVault>;
