import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { MessageActionDialog } from '../src/dziri/message-action-dialog';
import type { BubbleMessage } from '../src/dziri/message-bubble';

vi.mock('react-native', () => ({
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KeyboardAvoidingView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Modal: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
    visible ? <div role="dialog">{children}</div> : null,
  Pressable: ({
    children,
    onPress,
    disabled,
    accessibilityLabel,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
    accessibilityLabel?: string;
  }) => (
    <button disabled={disabled} aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
  ActivityIndicator: () => <span role="progressbar" />,
  Keyboard: { dismiss: () => {} },
  useWindowDimensions: () => ({ width: 375, height: 812 }),
  Platform: { OS: 'web' },
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({
    children,
    accessibilityRole,
  }: {
    children: React.ReactNode;
    accessibilityRole?: string;
  }) => <span role={accessibilityRole === 'alert' ? 'alert' : undefined}>{children}</span>,
  TextInput: ({
    value,
    onChangeText,
    accessibilityLabel,
    editable,
  }: {
    value: string;
    onChangeText: (value: string) => void;
    accessibilityLabel: string;
    editable: boolean;
  }) => (
    <textarea
      aria-label={accessibilityLabel}
      disabled={!editable}
      value={value}
      onChange={e => onChangeText(e.target.value)}
    />
  ),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('../src/dziri/icons', () => ({ Icon: () => null }));
vi.mock('../src/dziri/expression-picker', () => ({
  ExpressionPicker: ({ selectEmoji }: { selectEmoji: (emoji: string) => void }) => (
    <button onClick={() => selectEmoji('🎉')}>Pick emoji</button>
  ),
}));
vi.mock('../src/dziri/ui', () => ({
  useColors: () => ({
    text: '#111',
    secondary: '#666',
    surface: '#eee',
    background: '#fff',
    border: '#ddd',
    primary: '#111',
    onPrimary: '#fff',
  }),
}));
vi.mock('../src/dziri/locale', () => ({
  useLocale: () => ({
    locale: 'en',
    rtl: false,
    t: {
      messageActions: 'Message actions',
      more: 'More',
      copy: 'Copy',
      reply: 'Reply',
      react: 'React',
      moreEmojis: 'More emojis',
      copyText: 'Copy text',
      messageCopied: 'Message copied',
      editMessage: 'Edit message',
      deleteMessage: 'Delete message',
      deleteMessageTitle: 'Delete message?',
      deleteMessageDescription: 'This message will be removed for everyone.',
      save: 'Save',
      delete: 'Delete',
      cancel: 'Cancel',
      close: 'Close',
      actionFailed: "Couldn't complete this action. Try again.",
      editExpired: 'The edit window has ended.',
      edited: 'edited',
    },
  }),
}));
const mocks = vi.hoisted(() => ({ copy: vi.fn() }));
vi.mock('expo-clipboard', () => ({ setStringAsync: mocks.copy }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
const message: BubbleMessage = {
  id: 'm',
  senderId: 'me',
  name: 'Owner',
  body: 'Original',
  actionBody: 'Original',
  type: 'text',
  createdAt: Date.now(),
  reactions: [],
};
let edit: ReturnType<typeof vi.fn>,
  remove: ReturnType<typeof vi.fn>,
  close: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  edit = vi.fn().mockResolvedValue(null);
  remove = vi.fn().mockResolvedValue(null);
  close = vi.fn();
  mocks.copy.mockResolvedValue(true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
function button(label: string) {
  return [...host.querySelectorAll('button')].find(
    b => b.textContent === label || b.getAttribute('aria-label') === label,
  );
}
async function render(overrides: Partial<BubbleMessage> = {}) {
  await act(async () =>
    root.render(
      <MessageActionDialog
        message={{ ...message, createdAt: Date.now(), ...overrides }}
        myId="me"
        writable
        edit={edit}
        remove={remove}
        close={close}
      />,
    ),
  );
}
async function click(label: string) {
  await act(async () => button(label)!.click());
}
async function openEdit() {
  await click('More');
  await click('Edit message');
}
async function draft(value: string) {
  await act(async () => {
    const node = host.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

test('received text can be copied but cannot be edited or removed', async () => {
  await render({ senderId: 'peer' });
  expect(button('Copy text')).toBeDefined();
  expect(button('Edit message')).toBeUndefined();
  expect(button('Delete message')).toBeUndefined();
});

test('context actions use the screenshot reaction rail and bottom strip; edit lives under More', async () => {
  const react = vi.fn().mockResolvedValue(null),
    reply = vi.fn();
  await act(async () =>
    root.render(
      <MessageActionDialog
        message={message}
        myId="me"
        writable
        edit={edit}
        remove={remove}
        close={close}
        reply={reply}
        react={react}
      />,
    ),
  );
  expect(button('Reply')).toBeDefined();
  expect(button('Copy text')).toBeDefined();
  expect(button('Delete message')).toBeDefined();
  expect(button('More')).toBeDefined();
  expect(button('Edit message')).toBeUndefined();
  await click('More');
  expect(button('Edit message')).toBeDefined();
});

test('quick reactions call the canonical callback and close after acknowledgement', async () => {
  const react = vi.fn().mockResolvedValue(null);
  await act(async () =>
    root.render(
      <MessageActionDialog message={message} myId="me" writable react={react} close={close} />,
    ),
  );
  await click('React ❤️');
  expect(react).toHaveBeenCalledExactlyOnceWith('❤️');
  expect(close).toHaveBeenCalledOnce();
});

test('pending commands cannot be reply or reaction targets', async () => {
  await act(async () =>
    root.render(
      <MessageActionDialog
        message={{ ...message, local: true }}
        myId="me"
        writable
        reply={vi.fn()}
        react={vi.fn()}
        close={close}
      />,
    ),
  );
  expect(button('Reply')).toBeUndefined();
  expect(button('React ❤️')).toBeUndefined();
});

test('read-only conversations keep copy while hiding modifying actions', async () => {
  await act(async () =>
    root.render(
      <MessageActionDialog
        message={message}
        myId="me"
        writable={false}
        edit={edit}
        remove={remove}
        close={close}
      />,
    ),
  );
  expect(button('Copy text')).toBeDefined();
  expect(button('Edit message')).toBeUndefined();
  expect(button('Delete message')).toBeUndefined();
});
test.each([{ local: true }, { immutable: true }, { deleted: true }])(
  'pending, agreement or deleted content never offers destructive actions: %j',
  async overrides => {
    await render(overrides);
    expect(button('Edit message')).toBeUndefined();
    expect(button('Delete message')).toBeUndefined();
  },
);
test('removal requires confirmation and cancel never sends a command', async () => {
  await render();
  await click('Delete message');
  expect(remove).not.toHaveBeenCalled();
  expect(host.textContent).toContain('removed for everyone');
  await click('Cancel');
  expect(remove).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
});
test('removal waits for acknowledgement and duplicate clicks issue one command', async () => {
  let resolve!: () => void;
  remove.mockImplementation(
    () =>
      new Promise<void>(done => {
        resolve = done;
      }),
  );
  await render();
  await click('Delete message');
  await act(async () => {
    button('Delete')!.click();
    button('Delete')!.click();
  });
  expect(remove).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();
  expect(button('Cancel')?.disabled).toBe(true);
  await act(async () => resolve());
  expect(close).toHaveBeenCalledOnce();
});
test('empty and unchanged edits cannot be saved; Unicode edits are trimmed', async () => {
  await render();
  await openEdit();
  expect(button('Save')?.disabled).toBe(true);
  await draft('   ');
  expect(button('Save')?.disabled).toBe(true);
  await draft('  مرحبا Dziri 👋  ');
  await click('Save');
  expect(edit).toHaveBeenCalledOnce();
  expect(edit.mock.calls[0][1]).toBe('مرحبا Dziri 👋');
  expect(close).toHaveBeenCalledOnce();
});
test('failed edits preserve the draft and keep private errors out of the UI', async () => {
  edit.mockRejectedValueOnce(new Error('private backend detail'));
  await render();
  await openEdit();
  await draft('Updated');
  await click('Save');
  expect(close).not.toHaveBeenCalled();
  expect(host.querySelector('textarea')?.value).toBe('Updated');
  expect(host.textContent).toContain('Try again');
  expect(host.textContent).not.toContain('private backend detail');
  await click('Save');
  expect(close).toHaveBeenCalledOnce();
});
test('expiry while editing blocks the mutation without losing the draft', async () => {
  const createdAt = Date.now();
  await render({ createdAt });
  await openEdit();
  await draft('Updated');
  vi.spyOn(Date, 'now').mockReturnValue(createdAt + 900_001);
  await click('Save');
  expect(edit).not.toHaveBeenCalled();
  expect(host.querySelector('textarea')?.value).toBe('Updated');
  expect(host.textContent).toContain('edit window');
});
test('clipboard false return is failure, never a copied success message', async () => {
  mocks.copy.mockResolvedValueOnce(false);
  await render();
  await click('Copy text');
  expect(host.textContent).toContain('Try again');
  expect(host.textContent).not.toContain('Message copied');
  await click('Copy text');
  expect(mocks.copy).toHaveBeenLastCalledWith('Original');
  expect(close).toHaveBeenCalledOnce();
});
