import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useConvexConnectionState, useMutation } from 'convex/react';
import { dziriApi } from './api';

export function usePresenceHeartbeat(enabled: boolean) {
  const heartbeat = useMutation(dziriApi.heartbeat);
  const { isWebSocketConnected } = useConvexConnectionState();
  useEffect(() => {
    if (!enabled || !isWebSocketConnected) return;
    let sending = false,
      stopped = false;
    const beat = () => {
      if (stopped || sending || AppState.currentState !== 'active') return;
      sending = true;
      // Canonical preferences decide whether activity/last-seen may be updated.
      void heartbeat({ deviceLabel: `Dziri Messenger (${Platform.OS})` })
        .catch(() => {})
        .finally(() => {
          sending = false;
        });
    };
    beat();
    const timer = setInterval(beat, 45000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') beat();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      listener.remove();
    };
  }, [enabled, isWebSocketConnected, heartbeat]);
}
