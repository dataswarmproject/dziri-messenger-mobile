import {
  nativePushCoordinator,
  type NativePushRegistration,
} from './push-registration.generated.ts';

// Explicitly disabled until the separate DM package is registered and qualified.
// No environment variable, notification payload or link may enable this build.
export const PERSONAL_PUSH_CONFIGURED = false;
export type PersonalPushBridge = {
  // Return null without reading a token unless permission was already granted.
  // Permission prompts belong to an explicit user action, never app startup.
  getRegistration: () => Promise<unknown>;
  onTokenChange: (refresh: () => void) => () => void;
};
export function preparePersonalPush(
  bridge: PersonalPushBridge | undefined,
  register: (data: NativePushRegistration) => Promise<unknown>,
  configured = PERSONAL_PUSH_CONFIGURED,
) {
  return nativePushCoordinator(() => bridge?.getRegistration() ?? Promise.resolve(null), register, {
    enabled: configured && !!bridge,
  });
}
