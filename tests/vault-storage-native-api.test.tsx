import { beforeEach, expect, test, vi } from 'vitest';
import { openAccountVault } from '../src/dziri/message-vault-storage';

const state = vi.hoisted(() => ({
  disk: new Map<string, string>(),
  keys: new Map<string, string>(),
  combinedInputs: [] as unknown[],
  additionalData: [] as unknown[],
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
    }
    write(value: string) {
      state.disk.set(this.uri, value);
    }
    async text() {
      return state.disk.get(this.uri)!;
    }
    async move(target: File) {
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
});

test('a new native vault can read empty state and save encrypted bytes with supported AAD', async () => {
  const vault = await openAccountVault('synthetic-deployment', 'synthetic-actor');
  expect(await vault.read('thread')).toEqual({ body: '', pending: [] });
  await vault.save('thread', { body: 'Synthetic private draft' });
  expect(state.disk.size).toBe(1);
  expect([...state.disk.values()][0]).not.toContain('Synthetic private draft');
  expect(typeof state.additionalData[0]).toBe('string');
  expect(state.combinedInputs).toEqual([]);
});

test('an existing encrypted journal restores through the actual Expo AES wrapper and Android byte boundary', async () => {
  const first = await openAccountVault('synthetic-deployment', 'synthetic-actor');
  await first.save('thread', { body: 'Retained synthetic draft' });
  const encrypted = [...state.disk.values()][0];
  const reopened = await openAccountVault('synthetic-deployment', 'synthetic-actor');
  await expect(reopened.read('thread')).resolves.toMatchObject({
    body: 'Retained synthetic draft',
  });
  expect(state.disk.size).toBe(1);
  expect([...state.disk.values()][0]).toBe(encrypted);
});

test('a reopened journal can save a newer draft without requiring a destructive reset', async () => {
  const first = await openAccountVault('synthetic-deployment', 'synthetic-actor');
  await first.save('thread', { body: 'Existing synthetic draft' });
  const reopened = await openAccountVault('synthetic-deployment', 'synthetic-actor');
  await expect(reopened.save('thread', { body: 'New synthetic draft' })).resolves.toBeUndefined();
  expect(await reopened.read('thread')).toMatchObject({ body: 'New synthetic draft' });
});

test('tampered ciphertext stays rejected and is preserved for recovery', async () => {
  const first = await openAccountVault('synthetic-deployment', 'synthetic-actor');
  await first.save('thread', { body: 'Retained synthetic draft' });
  const [file, ciphertext] = [...state.disk.entries()][0];
  const bytes = Buffer.from(ciphertext, 'base64');
  bytes[bytes.length - 1] ^= 1;
  const damaged = bytes.toString('base64');
  state.disk.set(file, damaged);
  const keys = [...state.keys.entries()];
  const reopened = await openAccountVault('synthetic-deployment', 'synthetic-actor');
  await expect(reopened.read('thread')).rejects.toThrow();
  expect(state.disk.get(file)).toBe(damaged);
  expect([...state.keys.entries()]).toEqual(keys);
});
