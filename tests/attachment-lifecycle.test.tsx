import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAttachment } from '../src/dziri/use-attachment';
const state = vi.hoisted(() => ({
  upload: vi.fn(),
  url: vi.fn(),
  pick: vi.fn(),
  stop: vi.fn(),
  record: vi.fn(),
  permission: vi.fn(),
  mode: vi.fn(),
}));
const recorder = vi.hoisted(() => ({
  stop: vi.fn(),
  record: vi.fn(),
  prepareToRecordAsync: vi.fn(),
  isRecording: false,
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
}));
vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: state.permission,
  setAudioModeAsync: state.mode,
  useAudioRecorder: () => recorder,
  useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0 }),
}));
vi.mock('convex/react', () => ({ useMutation: () => state.url }));
vi.mock('../src/dziri/pick-document', () => ({
  pickDocument: state.pick,
  releaseDocument: vi.fn(),
}));
vi.mock('../src/dziri/media-upload', () => ({ uploadMedia: state.upload }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement, media: ReturnType<typeof useAttachment>;
function Harness({ imagesOnly = false }) {
  media = useAttachment(imagesOnly);
  return null;
}
beforeEach(async () => {
  vi.clearAllMocks();
  state.mode.mockResolvedValue(undefined);
  recorder.stop.mockResolvedValue(undefined);
  state.upload.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test('cancellation before upload completion preserves the draft attachment and cannot dispatch its late receipt', async () => {
  const document = { uri: 'local-document', type: 'file' as const, mime: 'application/pdf' };
  let finish!: (value: object) => void;
  state.upload.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await act(async () => media.change(document));
  let rejected: unknown;
  let result!: Promise<unknown>;
  await act(async () => {
    result = media.upload().catch(error => {
      rejected = error;
    });
  });
  const options = state.upload.mock.calls[0][2];
  await act(async () => options.onProgress(0.5));
  expect(media.progress).toBe(0.5);
  await act(async () => media.cancelUpload());
  expect(options.signal.aborted).toBe(true);
  await act(async () => finish({ ...document, storageId: 'late' }));
  await result;
  expect((rejected as Error).name).toBe('MediaUploadCancelled');
  expect(media.attachment).toEqual(document);
  expect(media.failed).toBe(false);
  expect(media.busy).toBe(false);
});
test('a prepared upload is reused after queue rejection; image-only lanes cannot select documents', async () => {
  const document = { uri: 'local-document', type: 'file' as const, mime: 'application/pdf' };
  state.pick.mockResolvedValue(document);
  state.upload.mockResolvedValue({ ...document, storageId: 'stored' });
  await act(async () => media.chooseDocument());
  await act(async () => media.upload());
  await act(async () => media.upload());
  expect(state.upload).toHaveBeenCalledOnce();
  await act(async () => root.render(<Harness imagesOnly />));
  await act(async () => media.chooseDocument());
  expect(state.pick).toHaveBeenCalledOnce();
});
test('unmount aborts a pending request and suppresses a late acknowledgement', async () => {
  let finish!: (value: object) => void;
  state.upload.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await act(async () =>
    media.change({ uri: 'local-document', type: 'file', mime: 'application/pdf' }),
  );
  let failed = false;
  let result!: Promise<unknown>;
  await act(async () => {
    result = media.upload().catch(() => {
      failed = true;
    });
  });
  const signal = state.upload.mock.calls[0][2].signal;
  await act(async () => root.render(null));
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ storageId: 'late' }));
  await result;
  expect(failed).toBe(true);
});
test('discarding while permission is pending prevents a later grant from starting recording', async () => {
  let grant!: (value: object) => void;
  state.permission.mockImplementation(
    () =>
      new Promise(resolve => {
        grant = resolve;
      }),
  );
  let result!: Promise<unknown>;
  await act(async () => {
    result = media.startVoice();
  });
  expect(media.requesting).toBe(true);
  await act(async () => media.cancelVoice());
  await act(async () => grant({ granted: true }));
  await result;
  expect(recorder.record).not.toHaveBeenCalled();
  expect(media.requesting).toBe(false);
});
