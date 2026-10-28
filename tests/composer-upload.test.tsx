import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageComposer } from '../src/dziri/message-composer';
const state = vi.hoisted(() => ({
  upload: vi.fn(),
  change: vi.fn(),
  submit: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('react-native', () => ({
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Pressable: ({ children, onPress }: React.PropsWithChildren<{ onPress: () => void }>) => (
    <button onClick={onPress}>{children}</button>
  ),
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  TextInput: React.forwardRef(
    (
      { value, onChangeText }: { value: string; onChangeText: (value: string) => void },
      ref: React.ForwardedRef<HTMLTextAreaElement>,
    ) => <textarea ref={ref} value={value} onChange={event => onChangeText(event.target.value)} />,
  ),
}));
vi.mock('../src/dziri/icons', () => ({
  IconButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onPress} disabled={disabled}>
      {label}
    </button>
  ),
}));
vi.mock('../src/dziri/figma', () => ({
  FigmaButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onPress} disabled={disabled}>
      {label}
    </button>
  ),
}));
vi.mock('../src/dziri/message-bubble', () => ({
  ReplyQuote: ({ reply }: { reply: { body: string } }) => <span>{reply.body}</span>,
}));
vi.mock('../src/dziri/local-messages', () => ({
  useLocalDraft: () => {
    const [body, setBody] = React.useState('Original caption');
    return {
      body,
      setBody,
      ready: true,
      failed: false,
      revision: 0,
      clearSent: () => {
        setBody('');
        return true;
      },
    };
  },
}));
vi.mock('../src/dziri/use-attachment', () => ({
  useAttachment: () => ({
    attachment: { uri: 'local-photo', type: 'image' },
    upload: state.upload,
    change: state.change,
    busy: false,
    failed: false,
    recording: false,
  }),
}));
vi.mock('../src/dziri/media-preview', () => ({ MediaPreview: () => null }));
vi.mock('../src/dziri/camera', () => ({ CameraCapture: () => null }));
vi.mock('../src/dziri/expression-picker', () => ({ ExpressionPicker: () => null }));
vi.mock('../src/dziri/ui', () => ({ useColors: () => ({}) }));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({ rtl: false, t: new Proxy({}, { get: (_, key) => String(key) }) }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  state.upload.mockReset();
  state.submit.mockReset().mockReturnValue(true);
  state.cancel.mockReset();
  state.change.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
test('a retired composer never sends a completed old upload', async () => {
  let finish!: (value: any) => void;
  state.upload.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await act(async () =>
    root.render(
      <MessageComposer
        reply={null}
        cancelReply={state.cancel}
        submit={() => false}
        submitMedia={state.submit}
      />,
    ),
  );
  await act(async () =>
    [...host.querySelectorAll('button')].find(node => node.textContent === 'send')!.click(),
  );
  await act(async () => root.render(<div>Replacement grant composer</div>));
  await act(async () =>
    finish({ type: 'image', storageId: 'old-upload', uri: 'local', mime: 'image/jpeg' }),
  );
  expect(state.submit).not.toHaveBeenCalled();
  expect(state.cancel).not.toHaveBeenCalled();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test.each([true, false])(
  'upload acknowledgements only clear the original reply snapshot (original reply: %s)',
  async original => {
    const oldReply = original
      ? { id: 'old', senderName: 'Peer', body: 'Old selection', deleted: false }
      : null;
    const newReply = { id: 'new', senderName: 'Peer', body: 'New selection', deleted: false };
    let finish!: (media: object) => void;
    state.upload.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const render = (reply: typeof oldReply) =>
      act(async () =>
        root.render(
          <MessageComposer
            reply={reply}
            cancelReply={state.cancel}
            submit={() => false}
            submitMedia={state.submit}
          />,
        ),
      );
    await render(oldReply);
    await act(async () =>
      [...host.querySelectorAll('button')].find(node => node.textContent === 'send')!.click(),
    );
    await render(newReply);
    const uploaded = {
      type: 'image',
      storageId: 'stored-photo',
      uri: 'local-photo',
      mime: 'image/jpeg',
    };
    await act(async () => finish(uploaded));
    expect(state.submit).toHaveBeenCalledWith(uploaded, 'Original caption', oldReply ?? undefined);
    expect(state.cancel).toHaveBeenCalledWith(oldReply);
    expect(host.textContent).toContain('New selection');
  },
);
