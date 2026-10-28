import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { test, expect, beforeEach, afterEach } from 'vitest';
import { useLocalDraft } from '../src/dziri/local-messages';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement, current: any;
function Draft({ scope }: { scope: string }) {
  current = useLocalDraft(scope);
  return <span>{current.body}</span>;
}
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test('an old completion cannot clear a newer draft, including an identical-text edit roundtrip', async () => {
  await act(async () => root.render(<Draft scope="chat" />));
  await act(async () => current.setBody('Original'));
  const revision = current.revision;
  await act(async () => {
    current.setBody('Temporary');
    current.setBody('Original');
  });
  let cleared;
  await act(async () => {
    cleared = current.clearSent('Original', revision);
  });
  expect(cleared).toBe(false);
  expect(current.body).toBe('Original');
  await act(async () => {
    cleared = current.clearSent('Original', current.revision);
  });
  expect(cleared).toBe(true);
  expect(current.body).toBe('');
});
test('a retained completion cannot clear a replacement scope or a closed composer', async () => {
  await act(async () => root.render(<Draft scope="old" />));
  await act(async () => current.setBody('Same'));
  const old = current;
  await act(async () => root.render(<Draft scope="new" />));
  await act(async () => current.setBody('Same'));
  expect(old.clearSent('Same', old.revision)).toBe(false);
  expect(current.body).toBe('Same');
  const closed = current;
  await act(async () => root.render(<div />));
  expect(closed.clearSent('Same', closed.revision)).toBe(false);
});
