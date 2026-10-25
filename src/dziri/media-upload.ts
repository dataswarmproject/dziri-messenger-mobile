export interface LocalMedia {
  uri: string;
  type: 'image' | 'video' | 'voice';
  mime: string;
  width?: number;
  height?: number;
  duration?: number;
}
export interface UploadedMedia extends LocalMedia {
  storageId: string;
  size: number;
}
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
export async function uploadMedia(
  media: LocalMedia,
  makeUrl: () => Promise<string>,
): Promise<UploadedMedia> {
  const blob = await (await fetch(media.uri)).blob();
  if (!blob.size || blob.size > MAX_MEDIA_BYTES) throw new Error('Invalid media size');
  const url = await makeUrl();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': media.mime },
    body: blob,
  });
  if (!response.ok) throw new Error('Upload failed');
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    !('storageId' in value) ||
    typeof value.storageId !== 'string'
  )
    throw new Error('Invalid upload receipt');
  return { ...media, storageId: value.storageId, size: blob.size };
}
