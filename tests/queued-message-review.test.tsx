import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { MessageComposer } from '../src/dziri/message-composer';
import { LocalMessagesProvider } from '../src/dziri/local-messages';
import { createMessageVault } from '../src/dziri/message-vault';
import { QueuedMessageReview } from '../src/dziri/queued-message-review';
import { localCopyRemovalCopy } from '../src/dziri/message-writes.generated';
const state = vi.hoisted(() => ({
  vault: undefined as any,
  edit: undefined as any,
  locale: 'en',
  submit: vi.fn(),
  close: vi.fn(),
}));
vi.mock('../src/dziri/message-vault-storage', () => ({ openAccountVault: () => state.vault }));
vi.mock('react-native', () => ({
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollView: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Pressable: ({ children, onPress, disabled }: any) => (
    <button onClick={onPress} disabled={disabled}>
      {children}
    </button>
  ),
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  TextInput: React.forwardRef(({ value, onChangeText }: any, ref: any) => {
    state.edit = onChangeText;
    return <textarea aria-label="Draft" value={value} readOnly ref={ref} />;
  }),
}));
vi.mock('../src/dziri/icons', () => ({
  IconButton: ({ label, onPress, disabled }: any) => (
    <button onClick={onPress} disabled={disabled}>
      {label}
    </button>
  ),
}));
vi.mock('../src/dziri/figma', () => ({
  FigmaButton: ({ label, onPress, disabled }: any) => (
    <button onClick={onPress} disabled={disabled}>
      {label}
    </button>
  ),
}));
vi.mock('../src/dziri/message-bubble', () => ({ ReplyQuote: () => null }));
vi.mock('../src/dziri/use-attachment', () => ({
  useAttachment: () => ({ attachment: null, busy: false, failed: false, recording: false }),
}));
vi.mock('../src/dziri/media-preview', () => ({ MediaPreview: () => null }));
vi.mock('../src/dziri/camera', () => ({ CameraCapture: () => null }));
vi.mock('../src/dziri/expression-picker', () => ({ ExpressionPicker: () => null }));
vi.mock('../src/dziri/ui', () => ({ useColors: () => ({}) }));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({
    locale: state.locale,
    rtl: state.locale === 'ar',
    t: new Proxy({}, { get: (_, key) => String(key) }),
  }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
const original = {
  id: 'legacy',
  body: 'Older retained text',
  createdAt: 1,
  status: 'failed',
  media: {
    type: 'file',
    storageId: 'storage',
    uri: 'local-file',
    mime: 'application/pdf',
    size: 3,
    name: 'invoice.pdf',
  },
};
const review = { id: original.id, body: original.body, attachment: 'invoice.pdf' };
beforeEach(async () => {
  state.locale = 'en';
  state.submit.mockReset();
  state.close.mockReset();
  let disk: string | null = null;
  state.vault = createMessageVault(
    {
      read: async () => disk,
      write: async value => {
        disk = value;
      },
      remove: async () => {},
      seal: async value => 'synthetic:' + value,
      open: async value => value.slice(10),
    },
    () => 2,
  );
  await state.vault.save('friends:thread:chat', { body: 'Current draft', pending: [original] });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const render = (message: any = review) =>
  act(async () =>
    root.render(
      <LocalMessagesProvider actor="fixture-alice" deployment="synthetic">
        <MessageComposer
          draftScope="friends:thread:chat"
          reply={null}
          cancelReply={() => {}}
          submit={state.submit}
          review={message}
          closeReview={state.close}
          removeLocal={id =>
            id === original.id
              ? state.vault.removePending('friends:thread:chat', original)
              : Promise.resolve(false)
          }
        />
      </LocalMessagesProvider>,
    ),
  );
test('review appends through the real encrypted journal without transport or mutation of the original attachment command', async () => {
  await render();
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find(b => b.textContent === 'Add text to current draft')!
      .click(),
  );
  const saved = await state.vault.read('friends:thread:chat');
  expect(saved.body).toBe('Current draft\nOlder retained text');
  expect(saved.pending).toEqual([original]);
  expect(state.submit).not.toHaveBeenCalled();
  expect(host.textContent).toContain('may already have arrived');
  expect(host.textContent).toContain('original message is kept');
  await act(async () =>
    [...host.querySelectorAll('button')].find(b => b.textContent === 'Keep for later')!.click(),
  );
  expect(state.close).toHaveBeenCalledOnce();
  expect((await state.vault.read('friends:thread:chat')).pending).toEqual([original]);
});
test('overlength review preserves both saved texts without overwriting the draft', async () => {
  await render();
  await act(async () => state.edit('x'.repeat(8000)));
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find(b => b.textContent === 'Add text to current draft')!
      .click(),
  );
  const saved = await state.vault.read('friends:thread:chat');
  expect(saved.body).toHaveLength(8000);
  expect(saved.pending).toEqual([original]);
  expect(host.textContent).toContain('exceeds 8,000');
  expect(state.submit).not.toHaveBeenCalled();
});

test('the actual composer confirms local removal, preserves a newer encrypted draft and another chat, and sends nothing', async () => {
  await state.vault.save('other', { body: 'Other draft', pending: [{ ...original, id: 'other' }] });
  await render();
  await act(async () => state.edit('Newer unsent draft'));
  const click = (label: string) =>
    act(async () =>
      [...host.querySelectorAll('button')].find(b => b.textContent === label)!.click(),
    );
  await click('Remove local copy');
  expect((await state.vault.read('friends:thread:chat')).pending).toHaveLength(1);
  await click('Keep local copy');
  expect(state.close).not.toHaveBeenCalled();
  await click('Remove local copy');
  await click('Remove this local copy');
  expect(await state.vault.read('friends:thread:chat')).toEqual({
    body: 'Newer unsent draft',
    pending: [],
  });
  expect((await state.vault.read('other')).pending[0].id).toBe('other');
  expect(state.close).toHaveBeenCalledOnce();
  expect(state.submit).not.toHaveBeenCalled();
});

test('native uncertain removal stays open, allows another attempt and never reports a successful deletion', async () => {
  const remove = vi.fn().mockResolvedValue(false);
  await act(async () =>
    root.render(
      <QueuedMessageReview
        message={review}
        occupied
        copied={false}
        onUse={() => {}}
        onClose={state.close}
        onRemove={remove}
      />,
    ),
  );
  const click = (label: string) =>
    act(async () =>
      [...host.querySelectorAll('button')].find(b => b.textContent === label)!.click(),
    );
  await click('Remove local copy');
  await click('Remove this local copy');
  expect(host.textContent).toContain('Could not confirm local removal');
  expect(state.close).not.toHaveBeenCalled();
  await click('Keep local copy');
  expect(remove).toHaveBeenCalledOnce();
  expect(host.textContent).toContain('Older retained text');
});

test('native delayed removal cannot close the next selected review', async () => {
  let finish!: (ok: boolean) => void;
  const remove = vi.fn(() => new Promise<boolean>(r => (finish = r)));
  const show = (id: string) =>
    act(async () =>
      root.render(
        <QueuedMessageReview
          message={{ ...review, id }}
          occupied
          copied={false}
          onUse={() => {}}
          onClose={state.close}
          onRemove={remove}
        />,
      ),
    );
  await show('old');
  const click = (label: string) =>
    act(async () =>
      [...host.querySelectorAll('button')].find(b => b.textContent === label)!.click(),
    );
  await click('Remove local copy');
  await click('Remove this local copy');
  await show('new');
  await act(async () => finish(true));
  expect(state.close).not.toHaveBeenCalled();
});

test('native removal uncertainty follows the current language', async () => {
  const remove = vi.fn().mockResolvedValue(false),
    show = () =>
      act(async () =>
        root.render(
          <QueuedMessageReview
            message={review}
            occupied
            copied={false}
            onUse={() => {}}
            onClose={state.close}
            onRemove={remove}
          />,
        ),
      );
  await show();
  const click = (label: string) =>
    act(async () =>
      [...host.querySelectorAll('button')].find(b => b.textContent === label)!.click(),
    );
  await click('Remove local copy');
  await click('Remove this local copy');
  state.locale = 'ar';
  await show();
  expect(host.textContent).toContain(localCopyRemovalCopy.ar.failed);
  expect(host.textContent).not.toContain(localCopyRemovalCopy.en.failed);
});
