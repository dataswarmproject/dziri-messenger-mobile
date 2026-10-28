export type NativePushRegistration = {
  platform: 'ios' | 'android';
  token: string;
  deviceId: string;
};

export function validNativePush(value: unknown): value is NativePushRegistration {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    (v.platform === 'ios' || v.platform === 'android') &&
    typeof v.token === 'string' &&
    v.token.length > 0 &&
    v.token.length <= 8192 &&
    typeof v.deviceId === 'string' &&
    v.deviceId.length > 0 &&
    v.deviceId.length <= 128
  );
}

// One coordinator per authenticated identity. Never register a result after
// that identity's effect is disposed, and avoid writing on every foreground.
export function nativePushCoordinator(
  get: () => Promise<unknown>,
  register: (data: NativePushRegistration) => Promise<unknown>,
  options: { enabled?: boolean } = {},
) {
  let disposed = false,
    busy = false,
    lastKey = '',
    lastRegistered = 0;
  return {
    dispose() {
      disposed = true;
    },
    async refresh() {
      if (options.enabled === false || disposed || busy) return;
      busy = true;
      try {
        const value = await get();
        if (disposed || !validNativePush(value)) return;
        const key = JSON.stringify([value.platform, value.token, value.deviceId]);
        if (key === lastKey && Date.now() - lastRegistered < 86400000) return;
        await register({
          platform: value.platform,
          token: value.token,
          deviceId: value.deviceId,
        });
        if (!disposed) {
          lastKey = key;
          lastRegistered = Date.now();
        }
      } finally {
        busy = false;
      }
    },
  };
}
