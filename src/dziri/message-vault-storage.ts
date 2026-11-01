import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import {
  AESEncryptionKey,
  AESKeySize,
  AESSealedData,
  aesEncryptAsync,
  aesDecryptAsync,
  digestStringAsync,
  CryptoDigestAlgorithm,
} from 'expo-crypto';
import { createMessageVault } from './message-vault';

/** Only ciphertext reaches ordinary storage; native keys remain in SecureStore. */
export async function openAccountVault(deployment: string, actor: string) {
  const namespace = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    `${deployment}\n${actor}`,
  );
  const name = `dm-local-v1.${namespace}`;
  const aad = new TextEncoder().encode(name);
  const native = Platform.OS !== 'web';
  const directory = native ? new Directory(Paths.document, 'dm-private') : null;
  const file = directory ? new File(directory, `${name}.enc`) : null;
  const temp = directory ? new File(directory, `${name}.pending`) : null;
  let recoverableCiphertext: string | undefined;
  const readKey = () =>
    native
      ? SecureStore.getItemAsync(name)
      : Promise.resolve(sessionStorage.getItem(`${name}.key`));
  let key: AESEncryptionKey | undefined;
  async function encryptionKey(create: boolean) {
    if (key) return key;
    const encoded = await readKey();
    if (encoded) return (key = await AESEncryptionKey.import(encoded, 'hex'));
    if (!create) throw new Error('Local encryption key unavailable');
    const generated = await AESEncryptionKey.generate(AESKeySize.AES256);
    const value = await generated.encoded('hex');
    if (native)
      await SecureStore.setItemAsync(name, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    else sessionStorage.setItem(`${name}.key`, value);
    return (key = generated);
  }
  return createMessageVault({
    read: async () => {
      if (!file) return sessionStorage.getItem(name);
      // Expo's native replacement removes the destination before moving the
      // staging file. Recover that file after an interrupted replacement only
      // when the main journal is absent; a present main remains authoritative.
      const source = file.exists ? file : temp?.exists ? temp : null;
      if (!source) return null;
      const ciphertext = await source.text();
      // Existing but incomplete data must not become an empty writable vault.
      // Authentication and journal validation happen before anything is saved.
      if (!ciphertext) throw new Error('Incomplete local journal');
      recoverableCiphertext = source === temp ? ciphertext : undefined;
      return ciphertext;
    },
    write: async ciphertext => {
      if (temp && file) {
        directory!.create({ idempotent: true, intermediates: true });
        // load() authenticated a recovered journal before this write, or this
        // instance finished staging it. Preserve that sole copy before reusing
        // the staging path, including if the next write is interrupted too.
        if (!file.exists && temp.exists) {
          if (recoverableCiphertext === undefined || (await temp.text()) !== recoverableCiphertext)
            throw new Error('Local journal changed before saving');
          await new File(temp.uri).move(file, { overwrite: false });
        }
        // File.move changes the instance URI; keep the reusable staging path intact.
        const staged = new File(temp.uri);
        staged.create({ overwrite: true });
        staged.write(ciphertext);
        recoverableCiphertext = ciphertext;
        await staged.move(file, { overwrite: true });
        recoverableCiphertext = undefined;
      } else sessionStorage.setItem(name, ciphertext);
    },
    remove: async () => {
      if (file) {
        try {
          if (file.exists) file.delete();
          if (temp?.exists) temp.delete();
        } finally {
          await SecureStore.deleteItemAsync(name);
        }
      } else {
        sessionStorage.removeItem(name);
        sessionStorage.removeItem(`${name}.key`);
      }
      key = undefined;
    },
    seal: async plaintext => {
      const data = await aesEncryptAsync(
        new TextEncoder().encode(plaintext),
        await encryptionKey(true),
        { additionalData: aad },
      );
      return data.combined('base64');
    },
    open: async ciphertext => {
      // Expo57's Android fromCombined bridge requires a typed byte array even
      // though its JavaScript declaration also accepts Base64 strings. Decode
      // the existing format without rewriting the journal or replacing its key.
      const bytes = Uint8Array.from(atob(ciphertext), character => character.charCodeAt(0));
      const data = await aesDecryptAsync(
        AESSealedData.fromCombined(bytes),
        await encryptionKey(false),
        { additionalData: aad },
      );
      return new TextDecoder().decode(data);
    },
  });
}
