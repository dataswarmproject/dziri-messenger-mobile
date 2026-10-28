import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';
import { PERSONAL_PUSH_CONFIGURED, preparePersonalPush } from '../src/dziri/push-registration';
import { usePersonalPush } from '../src/dziri/use-personal-push';
const state = vi.hoisted(() => ({ register: vi.fn(), listener: vi.fn() }));
vi.mock('convex/react', () => ({ useMutation: () => state.register }));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: state.listener },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const bridge = () => ({ getRegistration: vi.fn(), onTokenChange: vi.fn() });
test('this build is disabled and never reads provider permissions/tokens or calls the canonical registration API', async () => {
  expect(PERSONAL_PUSH_CONFIGURED).toBe(false);
  const provider = bridge(),
    register = vi.fn();
  const controller = preparePersonalPush(provider, register);
  await controller.refresh();
  await controller.refresh();
  controller.dispose();
  expect(provider.getRegistration).not.toHaveBeenCalled();
  expect(register).not.toHaveBeenCalled();
});
test('a missing native provider fails closed even if a future build is configured', async () => {
  const register = vi.fn();
  await preparePersonalPush(undefined, register, true).refresh();
  expect(register).not.toHaveBeenCalled();
});
test('the authenticated runtime stays passive, including when a provider is supplied', async () => {
  const provider = bridge();
  function Harness() {
    usePersonalPush('actor', provider);
    return null;
  }
  const host = document.createElement('div'),
    root = createRoot(host);
  await act(async () => root.render(<Harness />));
  await act(async () => root.unmount());
  expect(provider.getRegistration).not.toHaveBeenCalled();
  expect(provider.onTokenChange).not.toHaveBeenCalled();
  expect(state.listener).not.toHaveBeenCalled();
  expect(state.register).not.toHaveBeenCalled();
});
test('future provider payloads cannot select an authorization user or send unknown fields to registration', async () => {
  const provider = bridge(),
    register = vi.fn();
  provider.getRegistration.mockResolvedValue({
    platform: 'android',
    token: 'fixture-token',
    deviceId: 'install',
    userId: 'another-user',
    secret: 'drop-this',
  });
  const controller = preparePersonalPush(provider, register, true);
  await controller.refresh();
  await controller.refresh();
  expect(register).toHaveBeenCalledOnce();
  expect(register.mock.calls[0][0]).toEqual({
    platform: 'android',
    token: 'fixture-token',
    deviceId: 'install',
  });
});
