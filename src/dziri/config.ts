// Shared production backend used by Dziri Consumer and Business. This origin is public.
import dziriBackend from '../../config/dziri-backend.json' with { type: 'json' };
export const MAIN_DZIRI_CONVEX_URL = dziriBackend.convexUrl;

/** Configuration is fixed by the build, never supplied by a message or deep link. */
export function deploymentUrl(value: string, development: boolean): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = development && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return url.origin;
  } catch {
    return null;
  }
}

// Encoding every UTF-16 code unit avoids collisions from stripping auth-key punctuation.
export function secureStorageKey(key: string): string {
  let encoded = 'dziri.';
  for (let i = 0; i < key.length; i++) encoded += key.charCodeAt(i).toString(16).padStart(4, '0');
  return encoded;
}
