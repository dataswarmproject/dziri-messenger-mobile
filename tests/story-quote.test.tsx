import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { StoryQuote } from '../src/dziri/story-quote';
vi.mock('react-native', () => ({ View: ({ children }: any) => <div>{children}</div> }));
vi.mock('expo-image', () => ({
  Image: ({ source, onError }: any) => <img src={source.uri} onError={onError} />,
}));
vi.mock('../src/dziri/typography', () => ({
  Text: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('../src/dziri/icons', () => ({ Icon: ({ name }: any) => <span data-icon={name} /> }));
vi.mock('../src/dziri/locale', () => ({ useLocale: () => ({ locale: 'en', rtl: false }) }));
vi.mock('../src/dziri/ui', () => ({
  useColors: () => ({ outgoingText: '#fff', text: '#111', surface: '#eee', border: '#ddd' }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test('an authorized quoted Story keeps its author and text context after source expiry', async () => {
  await act(async () =>
    root.render(
      <StoryQuote
        story={{ authorId: 'author', authorName: 'Author', type: 'text', body: 'A story snapshot' }}
        outgoing
      />,
    ),
  );
  expect(host.textContent).toContain('Story reply');
  expect(host.textContent).toContain('Author');
  expect(host.textContent).toContain('A story snapshot');
});
test.each(['video', 'voice'])(
  'a %s snapshot never tries to load an audio/video URL as an image',
  async type => {
    await act(async () =>
      root.render(
        <StoryQuote story={{ authorId: 'author', type, mediaUrl: 'https://example.test/media' }} />,
      ),
    );
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('[data-icon="play"]')).not.toBeNull();
  },
);
test('unsafe or failed thumbnail URLs fall back without losing the quoted text', async () => {
  await act(async () =>
    root.render(
      <StoryQuote
        story={{
          authorId: 'author',
          type: 'photo',
          mediaUrl: 'javascript:fixture',
          body: 'Keep context',
        }}
      />,
    ),
  );
  expect(host.querySelector('img')).toBeNull();
  await act(async () =>
    root.render(
      <StoryQuote
        story={{
          authorId: 'author',
          type: 'photo',
          mediaUrl: 'https://example.test/photo',
          body: 'Keep context',
        }}
      />,
    ),
  );
  await act(async () =>
    host.querySelector('img')!.dispatchEvent(new Event('error', { bubbles: true })),
  );
  expect(host.querySelector('img')).toBeNull();
  expect(host.textContent).toContain('Keep context');
});
