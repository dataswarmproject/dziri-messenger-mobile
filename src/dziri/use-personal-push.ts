import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useMutation } from 'convex/react';
import { dziriApi } from './api';
import {
  PERSONAL_PUSH_CONFIGURED,
  preparePersonalPush,
  type PersonalPushBridge,
} from './push-registration';

export function usePersonalPush(actor?: string, bridge?: PersonalPushBridge) {
  const register = useMutation(dziriApi.registerPushToken);
  useEffect(() => {
    if (!PERSONAL_PUSH_CONFIGURED || !actor || !bridge || Platform.OS === 'web') return;
    const coordinator = preparePersonalPush(bridge, register);
    const refresh = () => {
      void coordinator.refresh().catch(() => {});
    };
    const unsubscribe = bridge.onTokenChange(refresh);
    const activity = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    refresh();
    return () => {
      coordinator.dispose();
      unsubscribe();
      activity.remove();
    };
  }, [actor, bridge, register]);
}
