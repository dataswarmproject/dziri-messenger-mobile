import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { inboxSessionScope } from './session-key';
import { secureStorageKey } from '../dziri/config';
import type { Session } from './client';

// Web previews keep credentials in memory. Native sessions use the OS vault.
let writes = Promise.resolve();
export function saveSession(
  origin: string,
  session: Session | null,
  identityScope = '',
  allowed: () => boolean = () => true,
) {
  if (Platform.OS === 'web') return Promise.resolve();
  const key = secureStorageKey(inboxSessionScope(origin, identityScope));
  writes = writes
    .catch(() => {})
    .then(() =>
      !allowed()
        ? undefined
        : session
          ? SecureStore.setItemAsync(key, JSON.stringify(session))
          : SecureStore.deleteItemAsync(key),
    );
  return writes;
}
export async function loadSession(origin: string, identityScope = ''): Promise<Session | null> {
  if (Platform.OS === 'web') return null;
  await writes.catch(() => {});
  const value = await SecureStore.getItemAsync(
    secureStorageKey(inboxSessionScope(origin, identityScope)),
  );
  if (!value) return null;
  const session = JSON.parse(value);
  return typeof session['access-token'] === 'string' &&
    typeof session.client === 'string' &&
    typeof session.uid === 'string'
    ? session
    : null;
}

/** Remove only this provider client, including a rotated token, never a replacement login. */
export function clearSessionIf(origin: string, identityScope: string, expected: Session) {
  if (Platform.OS === 'web') return Promise.resolve();
  const key = secureStorageKey(inboxSessionScope(origin, identityScope));
  writes = writes
    .catch(() => {})
    .then(async () => {
      const value = await SecureStore.getItemAsync(key);
      if (!value) return;
      const saved: unknown = JSON.parse(value);
      if (
        saved &&
        typeof saved === 'object' &&
        'client' in saved &&
        saved.client === expected.client &&
        'uid' in saved &&
        saved.uid === expected.uid
      )
        await SecureStore.deleteItemAsync(key);
    });
  return writes;
}
