import { useEffect, useRef, useState } from 'react';
import { InboxClient, type Profile, type Session } from './client';
import { clearSessionIf, loadSession, saveSession } from './session';
import {
  staffWorkspaceKey,
  staffCopy,
  type StaffWorkspace,
} from '../dziri/messenger-staff.generated';
type SessionError =
  | ''
  | 'workspaceStorage'
  | 'workspaceReconnect'
  | 'workspaceSecuritySetup'
  | 'workspaceLogoutFailed'
  | 'workspaceLogout';

export type StaffReservation = {
  accept: (session: Session) => Promise<void>;
  complete: () => void;
  release: () => Promise<void>;
};

/** Provider credentials never leave this staff-only lifecycle. */
export function useStaffSession(workspace: StaffWorkspace, proxy: boolean, locale: string) {
  const key = staffWorkspaceKey(workspace),
    copy = staffCopy(locale);
  const [state, setState] = useState<{
    key: string;
    client: InboxClient | null;
    profile: Profile | null;
    busy: boolean;
    error: SessionError;
  }>({ key, client: null, profile: null, busy: false, error: '' });
  const scope = useRef(key),
    epoch = useRef(0),
    alive = useRef(false),
    current = useRef<InboxClient | null>(null),
    locked = useRef(false),
    restoring = useRef(true),
    revoking = useRef(false);
  scope.current = key;
  const active = (generation: number, client?: InboxClient) =>
    alive.current &&
    scope.current === key &&
    epoch.current === generation &&
    (!client || current.current === client);
  function create(generation: number) {
    current.current?.dispose();
    const client = new InboxClient(workspace, fetch, proxy ? '/inbox-api' : workspace.origin);
    current.current = client;
    client.onSession = session => {
      if (!active(generation, client) || revoking.current) return;
      void saveSession(
        workspace.origin,
        session,
        key,
        () => active(generation, client) && !revoking.current,
      ).catch(() => {
        if (active(generation, client)) setState(s => ({ ...s, error: 'workspaceStorage' }));
      });
    };
    client.onUnauthorized = () => {
      if (!active(generation, client)) return;
      if (revoking.current) return;
      current.current = null;
      void saveSession(workspace.origin, null, key).catch(() => {});
      setState({ key, client: null, profile: null, busy: false, error: 'workspaceReconnect' });
    };
    return client;
  }
  useEffect(() => {
    const generation = ++epoch.current;
    alive.current = true;
    locked.current = false;
    restoring.current = true;
    revoking.current = false;
    setState({ key, client: null, profile: null, busy: true, error: '' });
    void (async () => {
      try {
        const saved = await loadSession(workspace.origin, key);
        if (!saved || !active(generation)) return;
        const client = create(generation);
        client.setSession(saved);
        const profile = await client.profile();
        if (active(generation, client)) setState({ key, client, profile, busy: false, error: '' });
      } catch {
        if (active(generation)) {
          current.current?.dispose();
          current.current = null;
          void saveSession(workspace.origin, null, key).catch(() => {});
          setState({
            key,
            client: null,
            profile: null,
            busy: false,
            error: 'workspaceReconnect',
          });
        }
      } finally {
        if (active(generation)) {
          restoring.current = false;
          setState(s => ({ ...s, busy: false }));
        }
      }
    })();
    return () => {
      alive.current = false;
      epoch.current++;
      current.current?.dispose();
      current.current = null;
    };
    // The immutable workspace key owns all async work; locale changes do not restart authentication.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, proxy]);
  async function login(
    email: string,
    password: string,
    mfa?: { token: string; code: string },
  ): Promise<string | undefined> {
    const generation = epoch.current;
    if (!active(generation) || locked.current || restoring.current) return;
    locked.current = true;
    revoking.current = false;
    setState(s => ({ ...s, key, busy: true, error: '' }));
    const client = mfa && current.current ? current.current : create(generation);
    try {
      const result = await client.login(
        mfa ? { mfa_token: mfa.token, otp_code: mfa.code } : { email, password },
      );
      if (!active(generation, client)) return;
      if (result.mfa_setup_required) {
        setState(s => ({ ...s, error: 'workspaceSecuritySetup' }));
        return;
      }
      if (result.mfa_required && result.mfa_token) return result.mfa_token;
      setState({ key, client, profile: result.data ?? null, busy: false, error: '' });
    } catch {
      if (active(generation))
        setState(s => ({ ...s, error: 'workspaceReconnect', profile: null, client: null }));
    } finally {
      if (active(generation)) {
        locked.current = false;
        setState(s => ({ ...s, busy: false }));
      }
    }
  }
  function reserveHandoff(): StaffReservation | null {
    const generation = epoch.current;
    if (!active(generation) || locked.current || restoring.current || state.profile) return null;
    locked.current = true;
    setState(s => ({ ...s, busy: true, error: '' }));
    let closed = false,
      committed = false,
      accepting = false;
    let candidate: { client: InboxClient; profile: Profile } | null = null;
    let issued: Session | null = null;
    const allowed = (client?: InboxClient) => !closed && active(generation, client);
    return {
      async accept(session) {
        if (!allowed() || accepting) throw new Error('Staff sign-in is no longer active');
        accepting = true;
        issued = { ...session };
        const client = create(generation);
        let verified: Session | null = null;
        // Profile rejection must not clear another mount's credentials.
        client.onUnauthorized = undefined;
        client.onSession = next => {
          verified = next;
        };
        client.setSession(session);
        const profile = await client.profile();
        if (!allowed(client) || !verified) throw new Error('Staff sign-in is no longer active');
        issued = verified;
        await saveSession(workspace.origin, verified, key, () => allowed(client));
        if (!allowed(client)) throw new Error('Staff sign-in is no longer active');
        candidate = { client, profile };
      },
      complete() {
        if (!candidate || !allowed(candidate.client))
          throw new Error('Staff sign-in is no longer active');
        const { client, profile } = candidate;
        client.onSession = session => {
          if (!active(generation, client) || revoking.current) return;
          void saveSession(
            workspace.origin,
            session,
            key,
            () => active(generation, client) && !revoking.current,
          ).catch(() => {
            if (active(generation, client)) setState(s => ({ ...s, error: 'workspaceStorage' }));
          });
        };
        client.onUnauthorized = () => {
          if (!active(generation, client) || revoking.current) return;
          current.current = null;
          if (issued) void clearSessionIf(workspace.origin, key, issued).catch(() => {});
          setState({ key, client: null, profile: null, busy: false, error: 'workspaceReconnect' });
        };
        closed = true;
        committed = true;
        locked.current = false;
        setState({ key, client, profile, busy: false, error: '' });
      },
      async release() {
        if (committed) return;
        const firstRelease = !closed;
        closed = true;
        candidate?.client.dispose();
        // Queue before waiting: a remount's load waits for this exact-client removal.
        const clearing = issued ? clearSessionIf(workspace.origin, key, issued) : Promise.resolve();
        if (firstRelease && active(generation)) {
          current.current?.dispose();
          current.current = null;
          locked.current = false;
          setState({ key, client: null, profile: null, busy: false, error: '' });
        }
        await clearing;
      },
    };
  }
  async function logout() {
    const generation = epoch.current,
      client = current.current;
    if (!client || !active(generation, client) || locked.current) return;
    locked.current = true;
    revoking.current = true;
    setState({ key, client: null, profile: null, busy: true, error: '' });
    // Enqueue local removal before any network wait so a fresh mount cannot resurrect it.
    const clearing = saveSession(workspace.origin, null, key);
    const revocation = client.signOut().then(
      () => true,
      () => false,
    );
    let local = true,
      remote = true;
    try {
      await clearing;
    } catch {
      local = false;
    }
    try {
      remote = await revocation;
    } catch {
      remote = false;
    } finally {
      client.dispose();
      if (current.current === client) current.current = null;
      if (active(generation)) {
        locked.current = false;
        setState({
          key,
          client: null,
          profile: null,
          busy: false,
          error: !local ? 'workspaceLogoutFailed' : remote ? '' : 'workspaceLogout',
        });
      }
    }
  }
  return {
    ...(state.key === key ? state : { key, client: null, profile: null, busy: true, error: '' }),
    error: state.key === key && state.error ? copy[state.error] : '',
    login,
    reserveHandoff,
    logout,
  };
}
