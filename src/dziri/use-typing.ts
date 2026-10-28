import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery } from 'convex/react';
import { dziriApi } from './api';

/** Only actual input activity is published; restored drafts never publish typing. */
export function useTyping(threadId: string, enabled: boolean) {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [now, setNow] = useState(Date.now);
  const available = enabled && focused && active;
  const rows = useQuery(dziriApi.typing, available ? { threadId } : 'skip');
  const publish = useMutation(dziriApi.setTyping),
    clear = useMutation(dziriApi.clearTyping);
  const last = useRef(0),
    announced = useRef(false),
    idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = useCallback(() => {
    clearTimeout(idle.current);
    idle.current = undefined;
    last.current = 0;
    if (announced.current) {
      announced.current = false;
      void clear({ threadId }).catch(() => {});
    }
  }, [clear, threadId]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', value => setActive(value === 'active'));
    const visibility = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    return () => {
      listener.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility);
    };
  }, [stop]);
  useEffect(() => {
    if (!available) stop();
    return stop;
  }, [available, stop]);
  useEffect(() => {
    if (!rows?.length) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [rows]);
  const activity = useCallback(
    (body: string) => {
      if (!available || !body.trim()) {
        stop();
        return;
      }
      if (Platform.OS === 'web' && document.visibilityState === 'hidden') return;
      const at = Date.now();
      if (!announced.current || at - last.current >= 2500) {
        last.current = at;
        announced.current = true;
        void publish({ threadId, state: 'typing' }).catch(() => {});
      }
      clearTimeout(idle.current);
      idle.current = setTimeout(stop, 3000);
    },
    [available, stop, publish, threadId],
  );
  // Older servers do not expose expiry; their reactive GC still clears rows.
  return {
    activity,
    stop,
    people: available
      ? (rows ?? []).filter(row => row.expiresAt === undefined || row.expiresAt > now)
      : [],
  };
}
