import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { secureStorageKey } from '../dziri/config';
import type { Session } from './client';

// Web previews keep credentials in memory. Native sessions use the OS vault.
let writes = Promise.resolve();
export function saveSession(origin: string, session: Session | null) {
  if (Platform.OS === 'web') return Promise.resolve();
  const key = secureStorageKey(`inbox:${origin}`);
  writes = writes
    .catch(() => {})
    .then(() =>
      session
        ? SecureStore.setItemAsync(key, JSON.stringify(session))
        : SecureStore.deleteItemAsync(key),
    );
  return writes;
}
export async function loadSession(origin: string): Promise<Session | null> {
  if (Platform.OS === 'web') return null;
  const value = await SecureStore.getItemAsync(secureStorageKey(`inbox:${origin}`));
  if (!value) return null;
  const session = JSON.parse(value);
  return typeof session['access-token'] === 'string' &&
    typeof session.client === 'string' &&
    typeof session.uid === 'string'
    ? session
    : null;
}
