import { beforeEach, expect, test, vi } from 'vitest';
import { openAccountVault } from '../src/dziri/message-vault-storage';
import type { OutgoingDraft } from '../src/dziri/outbox';
import { createOutbox } from '../src/dziri/outbox';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

const state = vi.hoisted(() => ({
  disk: new Map<string, string>(),
  keys: new Map<string, string>(),
  combinedInputs: [] as unknown[],
  additionalData: [] as unknown[],
  interruptAfterDestinationDelete: false,
  interruptAfterStagingCreate: false,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...parts: (string | Directory)[]) {
      this.uri = parts.map(part => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    create() {}
  }
  class File extends Directory {
    get exists() {
      return state.disk.has(this.uri);
    }
    create() {
      state.disk.set(this.uri, '');
      if (this.uri.endsWith('.pending') && state.interruptAfterStagingCreate) {
        state.interruptAfterStagingCreate = false;
        throw new Error('Synthetic process death after staging create');
      }
    }
    write(value: string) {
      state.disk.set(this.uri, value);
    }
    async text() {
      return state.disk.get(this.uri)!;
    }
    async move(target: File, options?: { overwrite?: boolean }) {
      // Expo57 prepares a local destination by deleting it before rename.
      if (state.disk.has(target.uri)) {
        if (!options?.overwrite) throw new Error('Destination exists');
        state.disk.delete(target.uri);
      }
      if (state.interruptAfterDestinationDelete) {
        state.interruptAfterDestinationDelete = false;
        throw new Error('Synthetic process death after destination preparation');
      }
      state.disk.set(target.uri, state.disk.get(this.uri)!);
      state.disk.delete(this.uri);
      this.uri = target.uri;
    }
    delete() {
      state.disk.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { document: 'synthetic-document' } };
});
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (key: string) => state.keys.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    state.keys.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    state.keys.delete(key);
  },
}));

// The installed Expo57 AES JavaScript wrapper remains REAL. Only its JSI
// boundary is replaced: Android's AesCryptoModule.kt fromCombined takes
// ByteArray, whose ByteArrayFrontendConverter accepts only Uint8Array. Unlike
// the web implementation and the older vault test, it cannot decode strings.
vi.mock('expo-crypto/src/aes/ExpoCryptoAES', async () => {
  const crypto = await import('node:crypto');
  class Key {
    constructor(readonly value: Buffer) {}
    static async generate() {
      return new Key(crypto.randomBytes(32));
    }
    static async import(value: string, encoding: BufferEncoding) {
      return new Key(Buffer.from(value, encoding));
    }
    async encoded(encoding: BufferEncoding) {
      return this.value.toString(encoding);
    }
  }
  class SealedData {
    constructor(readonly bytes: Buffer) {}
    static fromCombined(input: unknown) {
      state.combinedInputs.push(input);
      if (!(input instanceof Uint8Array)) {
        throw new TypeError('Android ByteArray boundary requires Uint8Array');
      }
      if (input.byteLength < 28) throw new TypeError('Invalid Android sealed data length');
      return new SealedData(Buffer.from(input));
    }
    async combined(encoding: BufferEncoding) {
      return this.bytes.toString(encoding);
    }
  }
  const native = {
    EncryptionKey: Key,
    SealedData,
    encryptAsync: async (input: Uint8Array, key: Key, options: { additionalData: string }) => {
      state.additionalData.push(options.additionalData);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key.value, iv);
      // Android EncryptOptions.additionalData is BinaryInput and its toBytes()
      // explicitly accepts base64 strings, in contrast to fromCombined.
      cipher.setAAD(Buffer.from(options.additionalData, 'base64'));
      return new SealedData(
        Buffer.concat([iv, cipher.update(input), cipher.final(), cipher.getAuthTag()]),
      );
    },
    decryptAsync: async (sealed: SealedData, key: Key, options: { additionalData: string }) => {
      const cipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key.value,
        sealed.bytes.subarray(0, 12),
        { authTagLength: 16 },
      );
      cipher.setAAD(Buffer.from(options.additionalData, 'base64'));
      cipher.setAuthTag(sealed.bytes.subarray(-16));
      return new Uint8Array(
        Buffer.concat([cipher.update(sealed.bytes.subarray(12, -16)), cipher.final()]),
      );
    },
  };
  return { default: native };
});
vi.mock('expo-crypto', async () => {
  const aes = await import('expo-crypto/src/aes/index');
  const crypto = await import('node:crypto');
  return {
    ...aes,
    CryptoDigestAlgorithm: { SHA256: 'sha256' },
    digestStringAsync: async (_: string, input: string) =>
      crypto.createHash('sha256').update(input).digest('hex'),
  };
});

beforeEach(() => {
  state.disk.clear();
  state.keys.clear();
  state.combinedInputs.length = 0;
  state.additionalData.length = 0;
  state.interruptAfterDestinationDelete = false;
  state.interruptAfterStagingCreate = false;
});

const deployment = 'synthetic-deployment';
const actor = 'synthetic-actor';
const scope = 'synthetic-thread';
const namespace = (url = deployment, owner = actor) =>
  `dm-local-v1.${createHash('sha256').update(`${url}\n${owner}`).digest('hex')}`;
const paths = (url = deployment, owner = actor) => {
  const base = `synthetic-document/dm-private/${namespace(url, owner)}`;
  return { main: `${base}.enc`, pending: `${base}.pending` };
};
const command = (id: string): OutgoingDraft => ({
  id,
  body: `Synthetic ${id}`,
  status: 'pending',
  createdAt: Date.now(),
});
const snapshot = () => ({ disk: [...state.disk.entries()], keys: [...state.keys.entries()] });

async function orphanPending() {
  const vault = await openAccountVault(deployment, actor);
  await vault.save(scope, { body: 'Previous synthetic draft' });
  const pending = command('queued-command');
  state.interruptAfterDestinationDelete = true;
  await expect(
    vault.save(scope, { body: 'Recovered synthetic draft', pending: [pending] }),
  ).rejects.toThrow('Synthetic process death');
  const location = paths();
  expect(state.disk.has(location.main)).toBe(false);
  expect(state.disk.get(location.pending)).toBeTruthy();
  expect(state.disk.get(location.pending)).not.toContain('Recovered synthetic draft');
  return { ...location, pendingCommand: pending };
}

// Authenticated but malformed plaintext distinguishes AES authentication from
// journal-schema validation. All fixture data and key material are synthetic.
function sealFixture(plaintext: string, name = namespace()) {
  const iv = randomBytes(12);
  const key = Buffer.from(state.keys.get(name)!, 'hex');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(name));
  return Buffer.concat([
    iv,
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString('base64');
}

test('a complete orphan staging journal restores draft and failed commands after restart', async () => {
  const { pendingCommand } = await orphanPending();
  const before = snapshot();
  const restarted = await openAccountVault(deployment, actor);
  const restored = await restarted.read(scope);
  expect(restored).toEqual({
    body: 'Recovered synthetic draft',
    pending: [{ ...pendingCommand, status: 'failed' }],
  });
  const transmit = vi.fn(async () => {}),
    changed = vi.fn();
  const outbox = createOutbox(transmit, () => 'unused-command-id', changed);
  outbox.restore(restored.pending);
  outbox.deactivate();
  outbox.activate();
  await Promise.resolve();
  expect(transmit).not.toHaveBeenCalled();
  expect(changed.mock.calls.at(-1)?.[0]).toEqual([{ ...pendingCommand, status: 'failed' }]);
  // Restoring must not clear or rewrite encrypted evidence either.
  expect(snapshot()).toEqual(before);
});

test.each([
  'empty',
  'malformed-base64',
  'tampered',
  'invalid-json',
  'invalid-schema',
  'missing-key',
])(
  'a %s orphan journal is rejected without deleting/replacing its bytes or key',
  async condition => {
    const { pending } = await orphanPending();
    if (condition === 'empty') state.disk.set(pending, '');
    if (condition === 'malformed-base64') state.disk.set(pending, 'not valid base64!');
    if (condition === 'tampered') {
      const bytes = Buffer.from(state.disk.get(pending)!, 'base64');
      bytes[bytes.length - 1] ^= 1;
      state.disk.set(pending, bytes.toString('base64'));
    }
    if (condition === 'invalid-json') state.disk.set(pending, sealFixture('not JSON'));
    if (condition === 'invalid-schema') {
      state.disk.set(
        pending,
        sealFixture(JSON.stringify({ version: 1, journals: [{ body: 12 }] })),
      );
    }
    if (condition === 'missing-key') state.keys.delete(namespace());
    const before = snapshot();
    const restarted = await openAccountVault(deployment, actor);
    await expect(restarted.read(scope)).rejects.toThrow();
    expect(snapshot()).toEqual(before);
    await expect(
      restarted.save(scope, { body: 'Replacement must not discard old data' }),
    ).rejects.toThrow();
    expect(snapshot()).toEqual(before);
  },
);

test.each(['empty', 'malformed', 'complete'])(
  'an existing main journal remains authoritative beside a %s pending file',
  async condition => {
    const vault = await openAccountVault(deployment, actor);
    await vault.save(scope, { body: 'Committed synthetic draft' });
    const { pending } = paths();
    const uncommitted = JSON.stringify({
      version: 1,
      journals: [
        { scope, body: 'Uncommitted synthetic draft', pending: [], updatedAt: Date.now() },
      ],
    });
    state.disk.set(
      pending,
      condition === 'empty'
        ? ''
        : condition === 'malformed'
          ? 'incomplete'
          : sealFixture(uncommitted),
    );
    const before = snapshot();
    const restarted = await openAccountVault(deployment, actor);
    await expect(restarted.read(scope)).resolves.toEqual({
      body: 'Committed synthetic draft',
      pending: [],
    });
    expect(snapshot()).toEqual(before);
  },
);

test('a present but invalid main journal is not silently replaced by a valid pending journal', async () => {
  const { pending, main } = await orphanPending();
  expect(state.disk.get(pending)).toBeTruthy();
  state.disk.set(main, 'broken committed data');
  const before = snapshot();
  const restarted = await openAccountVault(deployment, actor);
  await expect(restarted.read(scope)).rejects.toThrow();
  expect(snapshot()).toEqual(before);
});

test('orphan recovery is isolated by both deployment and account namespace', async () => {
  const { pendingCommand } = await orphanPending();
  const before = snapshot();
  const anotherAccount = await openAccountVault(deployment, 'synthetic-other-actor');
  const anotherDeployment = await openAccountVault('synthetic-other-deployment', actor);
  await expect(anotherAccount.read(scope)).resolves.toEqual({ body: '', pending: [] });
  await expect(anotherDeployment.read(scope)).resolves.toEqual({ body: '', pending: [] });
  expect(snapshot()).toEqual(before);

  const owner = await openAccountVault(deployment, actor);
  await expect(owner.read(scope)).resolves.toEqual({
    body: 'Recovered synthetic draft',
    pending: [{ ...pendingCommand, status: 'failed' }],
  });
});

test('moving staging bytes into another namespace cannot bypass authenticated account binding', async () => {
  const { pending } = await orphanPending();
  const otherActor = 'synthetic-other-actor';
  const destination = paths(deployment, otherActor);
  state.disk.set(destination.pending, state.disk.get(pending)!);
  // Even if key bytes happen to be shared, the authenticated namespace differs.
  state.keys.set(namespace(deployment, otherActor), state.keys.get(namespace())!);
  const before = snapshot();
  const other = await openAccountVault(deployment, otherActor);
  await expect(other.read(scope)).rejects.toThrow();
  expect(snapshot()).toEqual(before);
});

test('a confirmed removal tombstone survives interrupted replacement and rejects stale re-save', async () => {
  const removed = command('removed-command'),
    retained = command('retained-command');
  const vault = await openAccountVault(deployment, actor);
  await vault.save(scope, { body: 'Synthetic retained draft', pending: [removed, retained] });
  await expect(vault.removePending(scope, removed)).resolves.toBe(true);
  expect((await vault.read(scope)).pending.map(row => row.id)).toEqual([retained.id]);

  state.interruptAfterDestinationDelete = true;
  await expect(vault.save(scope, { body: 'Draft after confirmed removal' })).rejects.toThrow(
    'Synthetic process death',
  );
  expect(state.disk.has(paths().main)).toBe(false);
  expect(state.disk.get(paths().pending)).toBeTruthy();

  const restarted = await openAccountVault(deployment, actor);
  // An older same-owner producer finishes after recovery. The durable removal
  // must still suppress that exact command rather than resurrecting the ID.
  await restarted.save(scope, { pending: [removed, retained] });
  const final = await restarted.read(scope);
  expect(final.pending).toEqual([{ ...retained, status: 'failed' }]);
  expect(final.body).toBe('Draft after confirmed removal');
  const again = await openAccountVault(deployment, actor);
  expect((await again.read(scope)).pending).toEqual([{ ...retained, status: 'failed' }]);
});

test('a second crash while staging a save cannot destroy the sole recovered draft and queue', async () => {
  const { pendingCommand } = await orphanPending();
  const keys = [...state.keys.entries()];
  const recovered = await openAccountVault(deployment, actor);
  const expected = {
    body: 'Recovered synthetic draft',
    pending: [{ ...pendingCommand, status: 'failed' }],
  };
  expect(await recovered.read(scope)).toEqual(expected);

  // Reusing .pending with overwrite first truncates it. If it is still the
  // sole durable copy, this second interruption destroys the recovered state.
  state.interruptAfterStagingCreate = true;
  await expect(recovered.save(scope, { body: 'Uncommitted second draft' })).rejects.toThrow(
    'Synthetic process death after staging create',
  );
  expect([...state.keys.entries()]).toEqual(keys);

  const restartedAgain = await openAccountVault(deployment, actor);
  expect(await restartedAgain.read(scope)).toEqual(expected);
  const transmit = vi.fn(async () => {}),
    changed = vi.fn();
  const outbox = createOutbox(transmit, () => 'unused-command-id', changed);
  outbox.restore((await restartedAgain.read(scope)).pending);
  outbox.deactivate();
  outbox.activate();
  await Promise.resolve();
  expect(transmit).not.toHaveBeenCalled();
  expect(changed.mock.calls.at(-1)?.[0]).toEqual(expected.pending);
});

test('a recovered confirmed removal remains durable across a second pre-write staging crash', async () => {
  const removed = command('twice-removed'),
    retained = command('twice-retained');
  const initial = await openAccountVault(deployment, actor);
  await initial.save(scope, { body: 'Before confirmed removal', pending: [removed, retained] });
  await expect(initial.removePending(scope, removed)).resolves.toBe(true);

  state.interruptAfterDestinationDelete = true;
  await expect(initial.save(scope, { body: 'Recovered removal journal' })).rejects.toThrow(
    'Synthetic process death after destination preparation',
  );
  const recovered = await openAccountVault(deployment, actor);
  const expected = {
    body: 'Recovered removal journal',
    pending: [{ ...retained, status: 'failed' }],
  };
  expect(await recovered.read(scope)).toEqual(expected);
  const keys = [...state.keys.entries()];

  state.interruptAfterStagingCreate = true;
  await expect(recovered.save(scope, { body: 'Uncommitted post-recovery update' })).rejects.toThrow(
    'Synthetic process death after staging create',
  );
  expect([...state.keys.entries()]).toEqual(keys);

  const restartedAgain = await openAccountVault(deployment, actor);
  expect(await restartedAgain.read(scope)).toEqual(expected);
  await restartedAgain.save(scope, { pending: [removed, retained] });
  const final = await openAccountVault(deployment, actor);
  expect(await final.read(scope)).toEqual(expected);
});

test('clearing a recovered orphan explicitly removes its encrypted files and key', async () => {
  await orphanPending();
  const recovered = await openAccountVault(deployment, actor);
  expect((await recovered.read(scope)).body).toBe('Recovered synthetic draft');
  await recovered.clear();
  expect(state.disk.size).toBe(0);
  expect(state.keys.size).toBe(0);
  const restarted = await openAccountVault(deployment, actor);
  expect(await restarted.read(scope)).toEqual({ body: '', pending: [] });
});

test('an empty existing main remains an error even when the pending journal authenticates', async () => {
  const { main, pending } = await orphanPending();
  expect(state.disk.get(pending)).toBeTruthy();
  state.disk.set(main, '');
  const before = snapshot();
  const reopened = await openAccountVault(deployment, actor);
  await expect(reopened.read(scope)).rejects.toThrow();
  await expect(
    reopened.save(scope, { body: 'Must not replace recovery evidence' }),
  ).rejects.toThrow();
  expect(snapshot()).toEqual(before);
});

test('a same-instance retry after failed replacement preserves the last complete staging journal', async () => {
  const removed = command('same-instance-removed'),
    retained = command('same-instance-retained');
  const vault = await openAccountVault(deployment, actor);
  await vault.save(scope, { body: 'Initial same-instance draft', pending: [removed, retained] });
  await expect(vault.removePending(scope, removed)).resolves.toBe(true);

  state.interruptAfterDestinationDelete = true;
  await expect(vault.save(scope, { body: 'Last complete staged draft' })).rejects.toThrow(
    'Synthetic process death after destination preparation',
  );
  expect(state.disk.has(paths().main)).toBe(false);
  const keys = [...state.keys.entries()];

  // Keep this same live vault: it has not read the orphan through a fresh open.
  state.interruptAfterStagingCreate = true;
  await expect(vault.save(scope, { body: 'Incomplete same-instance retry' })).rejects.toThrow(
    'Synthetic process death after staging create',
  );
  expect([...state.keys.entries()]).toEqual(keys);

  const restarted = await openAccountVault(deployment, actor);
  const expected = {
    body: 'Last complete staged draft',
    pending: [{ ...retained, status: 'failed' }],
  };
  expect(await restarted.read(scope)).toEqual(expected);
  await restarted.save(scope, { pending: [removed, retained] });
  const again = await openAccountVault(deployment, actor);
  expect(await again.read(scope)).toEqual(expected);
});

test.each(['another-authenticated-journal', 'tampered-journal'])(
  'changed staging bytes (%s) after validated recovery are rejected without promotion or replacement',
  async condition => {
    const { pending, main } = await orphanPending();
    const recovered = await openAccountVault(deployment, actor);
    expect((await recovered.read(scope)).body).toBe('Recovered synthetic draft');
    if (condition === 'another-authenticated-journal') {
      state.disk.set(
        pending,
        sealFixture(
          JSON.stringify({
            version: 1,
            journals: [
              { scope, body: 'Concurrent synthetic draft', pending: [], updatedAt: Date.now() },
            ],
          }),
        ),
      );
    } else {
      const changed = Buffer.from(state.disk.get(pending)!, 'base64');
      changed[changed.length - 1] ^= 1;
      state.disk.set(pending, changed.toString('base64'));
    }
    const before = snapshot();
    await expect(
      recovered.save(scope, { body: 'Must not replace changed staging' }),
    ).rejects.toThrow();
    expect(snapshot()).toEqual(before);
    expect(state.disk.has(main)).toBe(false);

    const reopened = await openAccountVault(deployment, actor);
    if (condition === 'another-authenticated-journal') {
      expect(await reopened.read(scope)).toEqual({
        body: 'Concurrent synthetic draft',
        pending: [],
      });
    } else await expect(reopened.read(scope)).rejects.toThrow();
    expect(snapshot()).toEqual(before);
  },
);
