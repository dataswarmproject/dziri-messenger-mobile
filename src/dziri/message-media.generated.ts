export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 120;
export type LibrarySection = 'media' | 'audio' | 'files';
type SharedMessage = {
  type?: string;
  body?: string;
  mediaUrl?: string;
  deletedAt?: number;
  ciphertext?: unknown;
  moderationStatus?: string;
};
export function safeMediaUrl(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
function visible(message: SharedMessage) {
  return (
    message.deletedAt === undefined &&
    message.ciphertext === undefined &&
    !['blocked', 'blurred'].includes(message.moderationStatus ?? '')
  );
}
export function librarySection(message: SharedMessage): LibrarySection | null {
  if (!visible(message) || !message.mediaUrl || !safeMediaUrl(message.mediaUrl)) return null;
  if (['image', 'video', 'gif', 'sticker'].includes(message.type ?? '')) return 'media';
  if (message.type === 'voice') return 'audio';
  return message.type === 'file' ? 'files' : null;
}
export function sharedLinks(messages: SharedMessage[]) {
  const links = new Set<string>();
  for (const message of messages) {
    if (!visible(message)) continue;
    for (const raw of message.body?.match(/https?:\/\/[^\s<>"\u060c\u061b\u061f]+/gu) ?? []) {
      let link = raw.replace(/[.,!?;:]+$/gu, '');
      // Retain balanced parentheses in real URLs; strip prose closing brackets.
      while (
        link.endsWith(')') &&
        (link.match(/\)/g)?.length ?? 0) > (link.match(/\(/g)?.length ?? 0)
      )
        link = link.slice(0, -1);
      if (safeMediaUrl(link)) links.add(link);
    }
  }
  return [...links];
}
export function mediaBytes(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${Math.ceil(bytes)} B`;
  const unit = bytes < 1024 * 1024 ? 'KB' : 'MB';
  const value = bytes / (unit === 'KB' ? 1024 : 1024 * 1024);
  return `${Number(value.toFixed(1))} ${unit}`;
}
export class MediaUploadCancelled extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'MediaUploadCancelled';
  }
}
export function uploadBlob(
  blob: Blob,
  url: string,
  mime: string,
  options: {
    signal?: AbortSignal;
    onProgress?: (fraction: number) => void;
  } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new MediaUploadCancelled());
      return;
    }
    if (!blob.size || blob.size > MAX_MEDIA_BYTES || !safeMediaUrl(url)) {
      reject(new Error('Invalid upload'));
      return;
    }
    const xhr = new XMLHttpRequest();
    let settled = false;
    function finish(error?: Error, id?: string) {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else {
        options.onProgress?.(1);
        resolve(id!);
      }
    }
    function abort() {
      finish(new MediaUploadCancelled());
      xhr.abort();
    }
    xhr.open('POST', url);
    xhr.timeout = 120_000;
    xhr.setRequestHeader('Content-Type', mime || 'application/octet-stream');
    xhr.upload.onprogress = event => {
      if (!settled && event.lengthComputable && event.total > 0)
        options.onProgress?.(Math.max(0, Math.min(0.99, event.loaded / event.total)));
    };
    xhr.onload = () => {
      if (options.signal?.aborted) {
        finish(new MediaUploadCancelled());
        return;
      }
      try {
        if (xhr.status < 200 || xhr.status >= 300) throw new Error('Upload failed');
        const receipt: unknown = JSON.parse(xhr.responseText);
        if (
          !receipt ||
          typeof receipt !== 'object' ||
          !('storageId' in receipt) ||
          typeof receipt.storageId !== 'string' ||
          !receipt.storageId
        )
          throw new Error('Invalid upload receipt');
        finish(undefined, receipt.storageId);
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Upload failed'));
      }
    };
    xhr.onerror = () => finish(new Error('Upload failed'));
    xhr.ontimeout = () => finish(new Error('Upload timed out'));
    xhr.onabort = () => finish(new MediaUploadCancelled());
    options.signal?.addEventListener('abort', abort, { once: true });
    options.onProgress?.(0);
    try {
      xhr.send(blob);
    } catch (error) {
      finish(error instanceof Error ? error : new Error('Upload failed'));
    }
  });
}
