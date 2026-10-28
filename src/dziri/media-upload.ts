import { uploadBlob, MAX_MEDIA_BYTES, MediaUploadCancelled } from './message-media.generated.ts';
export { MAX_MEDIA_BYTES } from './message-media.generated.ts';
export interface LocalMedia {
  uri: string;
  type: 'image' | 'video' | 'voice' | 'file';
  mime: string;
  width?: number;
  height?: number;
  duration?: number;
  name?: string;
  size?: number;
}
export interface UploadedMedia extends LocalMedia {
  storageId: string;
  size: number;
}
export async function uploadMedia(
  media: LocalMedia,
  makeUrl: () => Promise<string>,
  options: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {},
): Promise<UploadedMedia> {
  if (options.signal?.aborted) throw new MediaUploadCancelled();
  const blob = await (await fetch(media.uri, { signal: options.signal })).blob();
  if (!blob.size || blob.size > MAX_MEDIA_BYTES) throw new Error('Invalid media size');
  const url = await makeUrl();
  const storageId = await uploadBlob(blob, url, media.mime, options);
  return { ...media, storageId, size: blob.size };
}
