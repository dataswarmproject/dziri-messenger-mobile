import React, { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { useObservedPlayback } from '../src/dziri/use-observed-playback';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
const player = { play: vi.fn(), pause: vi.fn() };
function Harness(props: any) {
  useObservedPlayback(props.player ?? player, props);
  return null;
}
async function show(props: any) {
  await act(async () => root.render(<Harness {...props} />));
}
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
test('ordinary chat media never starts automatically', async () => {
  await show({ playing: false });
  expect(player.play).not.toHaveBeenCalled();
  await show({ paused: true, playing: false });
  await show({ paused: false, playing: false });
  expect(player.play).not.toHaveBeenCalled();
});
test('temporary suspension resumes only playback that was running', async () => {
  await show({ autoPlay: true, playing: false });
  expect(player.play).toHaveBeenCalledTimes(1);
  await show({ autoPlay: true, paused: true, playing: true });
  await show({ autoPlay: true, paused: true, playing: false });
  await show({ autoPlay: true, paused: false, playing: false });
  expect(player.play).toHaveBeenCalledTimes(2);
  await show({ autoPlay: true, paused: true, playing: false });
  await show({ autoPlay: true, paused: false, playing: false });
  expect(player.play).toHaveBeenCalledTimes(2);
});
test('an explicit play request retries manual playback and reports a native error', async () => {
  const error = vi.fn();
  await show({ playing: false });
  player.play.mockImplementationOnce(() => {
    throw new Error('fixture');
  });
  await show({ playing: false, playRequest: 1, onError: error });
  expect(error).toHaveBeenCalledTimes(1);
  await show({ playing: false, playRequest: 2, onError: error });
  expect(player.play).toHaveBeenCalledTimes(2);
});

test('initial autoplay and explicit requests wait for temporary suspension to end', async () => {
  await show({ paused: true, autoPlay: true, playing: false, playRequest: 0 });
  expect(player.play).not.toHaveBeenCalled();
  await show({ paused: false, autoPlay: true, playing: false, playRequest: 0 });
  expect(player.play).toHaveBeenCalledTimes(1);
  await show({ paused: true, autoPlay: true, playing: false, playRequest: 2 });
  await show({ paused: false, autoPlay: true, playing: false, playRequest: 2 });
  expect(player.play).toHaveBeenCalledTimes(2);
});

test('starting a Story player suspends any already registered chat player', async () => {
  const first = { play: vi.fn(), pause: vi.fn() },
    second = { play: vi.fn(), pause: vi.fn() };
  await act(async () =>
    root.render(
      <>
        <Harness player={first} autoPlay playing />
        <Harness player={second} autoPlay />
      </>,
    ),
  );
  expect(first.pause).toHaveBeenCalled();
  expect(second.play).toHaveBeenCalledTimes(1);
});
test('development lifecycle replay does not leave an autoplay Story permanently paused', async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <Harness autoPlay playing />
      </StrictMode>,
    ),
  );
  expect(player.play).toHaveBeenCalledTimes(2);
  expect(player.pause).toHaveBeenCalled();
});
