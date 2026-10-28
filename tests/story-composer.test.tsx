import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { StoryComposer } from '../src/dziri/story-composer';
const h = vi.hoisted(() => ({
  upload: vi.fn(),
  create: vi.fn(),
  abort: vi.fn(),
  choose: vi.fn(),
  media: { uri: 'file:///photo.jpg', type: 'image', mime: 'image/jpeg' } as any,
}));
vi.mock('convex/react', () => ({ useMutation: () => h.create }));
vi.mock('../src/dziri/use-attachment', () => ({
  useAttachment: () => ({
    attachment: h.media,
    upload: h.upload,
    cancelUpload: h.abort,
    choose: h.choose,
    change: vi.fn(),
    progress: 0,
    busy: false,
    failed: false,
  }),
}));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({
    locale: 'en',
    rtl: false,
    t: {
      cancel: 'Cancel',
      yourStory: 'Your story',
      message: 'Message',
      publishStory: 'Publish',
      loading: 'Loading',
      camera: 'Camera',
      photo: 'Photo',
      cancelUpload: 'Cancel upload',
    },
  }),
}));
vi.mock('../src/dziri/ui', () => ({
  useColors: () => ({ text: '#111', primary: '#111', background: '#fff', secondary: '#666' }),
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: any) => <span>{children}</span>,
  TextInput: ({ value, onChangeText, accessibilityLabel, editable }: any) => (
    <textarea
      disabled={editable === false}
      aria-label={accessibilityLabel}
      value={value}
      onChange={e => onChangeText(e.target.value)}
    />
  ),
}));
vi.mock('../src/dziri/icons', () => ({
  IconButton: ({ label, onPress, disabled }: any) => (
    <button disabled={disabled} aria-label={label} onClick={onPress} />
  ),
}));
vi.mock('../src/dziri/figma', () => ({
  FigmaButton: ({ label, onPress, disabled }: any) => (
    <button disabled={disabled} aria-label={label} onClick={onPress} />
  ),
}));
vi.mock('../src/dziri/camera', () => ({ CameraCapture: () => null }));
vi.mock('../src/dziri/media-preview', () => ({ MediaPreview: () => null }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  KeyboardAvoidingView: ({ children }: any) => <div>{children}</div>,
  View: ({ children }: any) => <div>{children}</div>,
  Modal: ({ children }: any) => <div>{children}</div>,
  Pressable: ({ children, onPress, disabled, accessibilityLabel }: any) => (
    <button aria-label={accessibilityLabel} disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
let mounted: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  h.media = { uri: 'file:///photo.jpg', type: 'image', mime: 'image/jpeg' };
  h.create.mockResolvedValue('story');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  mounted = true;
});
afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  host.remove();
});
async function show(close = vi.fn()) {
  await act(async () => root.render(<StoryComposer close={close} />));
  return close;
}
async function publish() {
  await act(async () =>
    [...host.querySelectorAll('button')].find(b => b.textContent === 'Publish')!.click(),
  );
}
test('closing during upload aborts immediately and prevents late Story publication', async () => {
  let finish!: (value: any) => void;
  h.upload.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const close = await show();
  await publish();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Cancel"]')!.click());
  expect(close).toHaveBeenCalledTimes(1);
  expect(h.abort).toHaveBeenCalled();
  await act(async () => finish({ ...h.media, storageId: 'upload' }));
  expect(h.create).not.toHaveBeenCalled();
});
test('unmount invalidates a delayed upload even when its adapter cannot cancel', async () => {
  let finish!: (value: any) => void;
  h.upload.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await show();
  await publish();
  await act(async () => root.unmount());
  mounted = false;
  await act(async () => finish({ ...h.media, storageId: 'upload' }));
  expect(h.create).not.toHaveBeenCalled();
});
test('video selection publishes its real media type and duration and locks editing while sending', async () => {
  h.media = { uri: 'file:///video.mp4', type: 'video', mime: 'video/mp4', duration: 12300 };
  let finish!: (value: any) => void;
  h.upload.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await show();
  await publish();
  expect(host.querySelector('textarea')!.disabled).toBe(true);
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Photo"]')!.disabled).toBe(true);
  await act(async () => finish({ ...h.media, storageId: 'video' }));
  expect(h.create).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'video',
      mediaStorageId: 'video',
      mediaDurationMs: 12300,
      audience: 'followers',
    }),
  );
});
