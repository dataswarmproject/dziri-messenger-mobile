import test from 'node:test';
import assert from 'node:assert/strict';
import { messengerColors } from '../src/dziri/colors.ts';
import { createWebSessionStorage } from '../src/dziri/session-storage.ts';

function rgb(hex) {
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
}
function luminance(hex) {
  return rgb(hex)
    .map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

test('monochrome controls retain readable button labels in both appearances; read ticks keep their accent', () => {
  for (const dark of [false, true]) {
    const colors = messengerColors(dark);
    for (const slot of ['primary', 'onPrimary', 'selection']) {
      assert.equal(typeof colors[slot], 'string');
      const channels = rgb(colors[slot]);
      assert.ok(Math.max(...channels) - Math.min(...channels) <= 10, `${slot} must be neutral`);
    }
    const a = luminance(colors.primary),
      b = luminance(colors.onPrimary);
    assert.ok(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 7,
      'button foreground must stay readable',
    );
    const ticks = rgb(colors.readReceipt);
    assert.ok(Math.max(...ticks) - Math.min(...ticks) > 100, 'read receipt accent is preserved');
  }
});

test('enabled switches keep visible tracks and thumbs in both states and appearances', () => {
  const contrast = (a, b) => {
    const first = luminance(a),
      second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  for (const dark of [false, true]) {
    const colors = messengerColors(dark);
    for (const [track, thumb] of [
      [colors.switchOffTrack, colors.switchOffThumb],
      [colors.primary, colors.onPrimary],
    ]) {
      assert.ok(contrast(track, colors.background) >= 3, 'track must stand out from the page');
      assert.ok(contrast(track, thumb) >= 3, 'thumb must stand out from the track');
    }
  }
});

test('web auth survives adapter recreation and logout removes only the selected session keys', () => {
  const entries = new Map([['other-app', 'untouched']]);
  const tabStorage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  };
  const first = createWebSessionStorage(() => tabStorage);
  first.setItem('dziri-auth-session', 'test-session');
  const afterReload = createWebSessionStorage(() => tabStorage);
  assert.equal(afterReload.getItem('dziri-auth-session'), 'test-session');
  afterReload.removeItem('dziri-auth-session');
  assert.equal(first.getItem('dziri-auth-session'), null);
  assert.equal(entries.get('other-app'), 'untouched');
});

test('web auth resolves storage lazily and does not hide unavailable persistence', () => {
  const adapter = createWebSessionStorage(() => {
    throw new Error('Storage unavailable');
  });
  assert.throws(() => adapter.getItem('dziri-auth-session'), /Storage unavailable/);
  assert.throws(() => adapter.setItem('dziri-auth-session', 'test-session'), /Storage unavailable/);
});
