import { test, expect, vi, beforeEach } from 'vitest';
import { openAccountVault } from '../src/dziri/message-vault-storage';
const state = vi.hoisted(() => ({
  disk: new Map<string, string>(),
  keys: new Map<string, string>(),
  failKey: false,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts
        .map(part => (typeof part === 'string' ? part : (part as Directory).uri))
        .join('/');
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
    write(text: string) {
      state.disk.set(this.uri, text);
    }
    async text() {
      return state.disk.get(this.uri)!;
    }
    async move(target: File) {
      if (target.uri === this.uri) throw new Error('Same path');
      state.disk.set(target.uri, state.disk.get(this.uri)!);
      state.disk.delete(this.uri);
      this.uri = target.uri;
    }
    delete() {
      state.disk.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { document: 'document' } };
});
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (key: string) => state.keys.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (state.failKey) throw new Error('Key store unavailable');
    state.keys.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    state.keys.delete(key);
  },
}));
vi.mock('expo-crypto', async () => {
  const crypto = await import('node:crypto');
  class Key {
    constructor(public key: Buffer) {}
    static async generate() {
      return new Key(crypto.randomBytes(32));
    }
    static async import(text: string) {
      return new Key(Buffer.from(text, 'hex'));
    }
    async encoded() {
      return this.key.toString('hex');
    }
  }
  return {
    AESEncryptionKey: Key,
    AESKeySize: { AES256: 256 },
    CryptoDigestAlgorithm: { SHA256: 'sha256' },
    digestStringAsync: async (_: string, text: string) =>
      crypto.createHash('sha256').update(text).digest('hex'),
    AESSealedData: { fromCombined: (text: string) => Buffer.from(text, 'base64') },
    aesEncryptAsync: async (
      text: Uint8Array,
      key: Key,
      options: { additionalData: Uint8Array },
    ) => {
      const iv = crypto.randomBytes(12),
        cipher = crypto.createCipheriv('aes-256-gcm', key.key, iv);
      cipher.setAAD(options.additionalData);
      const data = Buffer.concat([iv, cipher.update(text), cipher.final(), cipher.getAuthTag()]);
      return { combined: async () => data.toString('base64') };
    },
    aesDecryptAsync: async (data: Buffer, key: Key, options: { additionalData: Uint8Array }) => {
      const cipher = crypto.createDecipheriv('aes-256-gcm', key.key, data.subarray(0, 12));
      cipher.setAAD(options.additionalData);
      cipher.setAuthTag(data.subarray(-16));
      return Buffer.concat([cipher.update(data.subarray(12, -16)), cipher.final()]);
    },
  };
});
beforeEach(() => {
  state.disk.clear();
  state.keys.clear();
  state.failKey = false;
});
test('repeated staged replacements survive restart even though File.move changes its URI', async () => {
  const vault = await openAccountVault('deployment', 'alice');
  await vault.save('thread', { body: 'First private draft' });
  await vault.save('thread', { body: 'New private draft' });
  await vault.save('thread', {
    pending: [
      { id: 'command', body: 'Queued private message', status: 'pending', createdAt: Date.now() },
    ],
  });
  expect(state.disk.size).toBe(1);
  expect([...state.disk.values()][0]).not.toContain('private');
  const reopened = await openAccountVault('deployment', 'alice');
  expect(await reopened.read('thread')).toMatchObject({
    body: 'New private draft',
    pending: [{ id: 'command', status: 'failed' }],
  });
  await vault.clear();
  expect(state.disk.size).toBe(0);
  expect(state.keys.size).toBe(0);
});
test('failed SecureStore writes never leave ciphertext encrypted with an unpersisted cached key', async () => {
  state.failKey = true;
  const vault = await openAccountVault('deployment', 'alice');
  await expect(vault.save('thread', { body: 'Private' })).rejects.toThrow('Key store');
  expect(state.disk.size).toBe(0);
  state.failKey = false;
  await vault.save('thread', { body: 'Recovered' });
  expect(await (await openAccountVault('deployment', 'alice')).read('thread')).toMatchObject({
    body: 'Recovered',
  });
});
