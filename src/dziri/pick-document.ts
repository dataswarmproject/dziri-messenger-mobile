import { File, Paths } from 'expo-file-system';
import { MAX_MEDIA_BYTES } from './message-media.generated';
import type { LocalMedia } from './media-upload';
export async function pickDocument(): Promise<LocalMedia | null> {
  const selection = await File.pickFileAsync({ multipleFiles: false });
  if (selection.canceled) return null;
  const file = selection.result;
  if (!file.size || file.size > MAX_MEDIA_BYTES) throw new Error('Invalid document size');
  // A provider URI may not be readable by fetch/XHR; use a bounded cache copy.
  const extension = file.name.match(/\.[a-zA-Z0-9]{1,12}$/)?.[0] ?? '';
  const copy = new File(
    Paths.cache,
    `dm-document-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`,
  );
  file.copy(copy);
  return {
    uri: copy.uri,
    type: 'file',
    mime: file.type || 'application/octet-stream',
    name: file.name.slice(0, 255),
    size: file.size,
  };
}
export function releaseDocument(uri: string) {
  const ownedPrefix = new File(Paths.cache, 'dm-document-').uri;
  if (uri.startsWith(ownedPrefix)) {
    try {
      new File(uri).delete();
    } catch {}
  }
}
