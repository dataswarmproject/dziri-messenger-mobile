import { useEffect, useRef, useState } from 'react';
import { InboxClient, type Profile } from './client';
import { loadSession, saveSession } from './session';
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
        if (active(generation)) setState(s => ({ ...s, busy: false }));
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
    if (!active(generation) || locked.current) return;
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
    logout,
  };
}
