import type { LocalMedia } from './media-upload';
import { MAX_MEDIA_BYTES } from './message-media.generated';
export function pickDocument(): Promise<LocalMedia | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      if (!file.size || file.size > MAX_MEDIA_BYTES) {
        reject(new Error('Invalid document size'));
        return;
      }
      resolve({
        uri: URL.createObjectURL(file),
        type: 'file',
        mime: file.type || 'application/octet-stream',
        name: file.name.slice(0, 255),
        size: file.size,
      });
    };
    document.body.append(input);
    input.click();
  });
}
export function releaseDocument(_uri: string) {}
