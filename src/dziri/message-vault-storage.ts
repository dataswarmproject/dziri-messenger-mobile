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
    read: async () => (file ? (file.exists ? file.text() : null) : sessionStorage.getItem(name)),
    write: async ciphertext => {
      if (temp && file) {
        directory!.create({ idempotent: true, intermediates: true });
        // File.move changes the instance URI; keep the reusable staging path intact.
        const staged = new File(temp.uri);
        staged.create({ overwrite: true });
        staged.write(ciphertext);
        await staged.move(file, { overwrite: true });
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
      const data = await aesDecryptAsync(
        AESSealedData.fromCombined(ciphertext),
        await encryptionKey(false),
        { additionalData: aad },
      );
      return new TextDecoder().decode(data);
    },
  });
}
