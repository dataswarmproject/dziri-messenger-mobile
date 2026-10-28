import { validStaffWorkspace, type StaffWorkspace } from '../dziri/messenger-staff.generated.ts';
import { boundStaffProfile, boundStaffSession } from './workspace-policy.ts';
export type Session = { 'access-token': string; client: string; uid: string };
type LoginResult = {
  data?: Profile;
  mfa_required?: boolean;
  mfa_token?: string;
  mfa_setup_required?: boolean;
};
export type Account = { id: number; name: string; role: string; status: string };
export type Profile = {
  id: number;
  name: string;
  email: string;
  pubsub_token: string;
  account_id?: number;
  accounts: Account[];
};
export type Message = {
  id: number;
  conversation_id: number;
  content?: string;
  private?: boolean;
  message_type: number;
  created_at: number;
  status?: string;
  sender?: { name?: string };
  content_attributes?: { deleted?: boolean };
  attachments?: { id: number; file_type: string; data_url: string }[];
};
export type Conversation = {
  id: number;
  account_id: number;
  status: string;
  can_reply: boolean;
  unread_count: number;
  messages: Message[];
  inbox_id: number;
  meta: { sender?: { name?: string }; assignee?: { id: number; name?: string } };
};

export function inboxOrigin(value: string, development = false): string {
  const url = new URL(value.trim());
  const local = ['localhost', '127.0.0.1', '[::1]', '10.0.2.2'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !(url.protocol === 'https:' || (development && local && url.protocol === 'http:'))
  ) {
    throw new Error('Use the HTTPS origin of your Dziri Inbox installation.');
  }
  return url.origin;
}

export function mergeMessages(previous: Message[], incoming: Message[]): Message[] {
  return [
    ...new Map([...previous, ...incoming].map(message => [message.id, message])).values(),
  ].sort((a, b) => a.id - b.id);
}

export class InboxError extends Error {
  status: number;
  constructor(status: number) {
    super(
      status === 401
        ? 'Session expired. Sign in again.'
        : 'Inbox request failed. Check your connection and access.',
    );
    this.status = status;
  }
}

// This client talks to the same Rails controllers as the existing web dashboard.
// There is no second database, copied inbox or client-side permission authority.
export class InboxClient {
  private session: Session | null = null;
  private pending = new Set<AbortController>();
  private closed = false;
  private sequence = 0;
  private rotatedAt = 0;
  private validated = false;
  private readonly workspace: StaffWorkspace;
  readonly origin: string;
  readonly proxied: boolean;
  private fetcher: typeof fetch;
  private base: string;
  onSession?: (session: Session) => void;
  onUnauthorized?: () => void;

  constructor(workspace: StaffWorkspace, fetcher: typeof fetch = fetch, base = workspace.origin) {
    if (
      !validStaffWorkspace(workspace, workspace.actorId, workspace.companyId) ||
      (base !== workspace.origin && base !== '/inbox-api')
    )
      throw new Error('Staff workspace unavailable');
    this.workspace = Object.freeze({ ...workspace });
    this.origin = workspace.origin;
    this.proxied = base === '/inbox-api';
    this.fetcher = fetcher.bind(globalThis);
    this.base = base;
  }
  setSession(session: Session) {
    this.session = boundStaffSession(this.workspace, session);
    this.validated = false;
  }
  dispose() {
    this.closed = true;
    this.pending.forEach(controller => controller.abort());
    this.pending.clear();
    this.session = null;
    this.validated = false;
  }
  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (this.closed) throw new Error('Inbox session is closed');
    const target = new URL(path, 'https://staff.invalid');
    if (
      target.origin !== 'https://staff.invalid' ||
      target.pathname !== path.split('?')[0] ||
      target.hash
    )
      throw new Error('Invalid staff request path');
    for (const match of path.matchAll(/\/(?:accounts|conversations)\/([^/?]+)/g))
      if (!/^[1-9]\d*$/.test(match[1]) || !Number.isSafeInteger(Number(match[1])))
        throw new Error('Invalid staff record identity');
    const account = path.match(/^\/api\/v1\/accounts\/([^/]+)\//);
    if (account && (!this.validated || account[1] !== String(this.workspace.accountId)))
      throw new Error('Staff workspace is not verified');
    const sequence = ++this.sequence;
    const controller = new AbortController();
    this.pending.add(controller);
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await this.fetcher(`${this.base}${path}`, {
        method,
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.session,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (this.closed) throw new Error('Inbox session is closed');
      if (response.status === 401 || response.status === 403) {
        this.dispose();
        this.onUnauthorized?.();
      }
      if (!response.ok) throw new InboxError(response.status);
      const token = response.headers.get('access-token');
      const client = response.headers.get('client');
      const uid = response.headers.get('uid');
      if ((token || client || uid) && !(token && client && uid)) {
        this.dispose();
        this.onUnauthorized?.();
        throw new Error('Incomplete staff session.');
      }
      if (token && client && uid && sequence >= this.rotatedAt) {
        let next: Session;
        try {
          next = boundStaffSession(this.workspace, { 'access-token': token, client, uid });
        } catch {
          this.dispose();
          this.onUnauthorized?.();
          throw new Error('Staff session changed.');
        }
        this.rotatedAt = sequence;
        this.session = next;
        if (this.validated) this.onSession?.(this.session);
      }
      const text = await response.text();
      return JSON.parse(text || 'null');
    } finally {
      clearTimeout(timeout);
      this.pending.delete(controller);
    }
  }
  async login(
    credentials: { email: string; password: string } | { mfa_token: string; otp_code: string },
  ): Promise<LoginResult> {
    if ('email' in credentials && credentials.email.trim().toLowerCase() !== this.workspace.email)
      throw new Error('Use the staff identity linked in Dziri.');
    const result = await this.request<{
      data?: Profile;
      mfa_required?: boolean;
      mfa_token?: string;
      mfa_setup_required?: boolean;
    }>('/auth/sign_in', 'POST', credentials);
    if (result.mfa_setup_required === true) return { mfa_setup_required: true };
    if (result.mfa_required === true) {
      if (
        typeof result.mfa_token !== 'string' ||
        !result.mfa_token ||
        result.mfa_token.length > 4096 ||
        /[\u0000-\u001f\u007f]/.test(result.mfa_token)
      )
        throw new Error('Invalid staff verification challenge.');
      return { mfa_required: true, mfa_token: result.mfa_token };
    }
    if (!result.data || !this.session) throw new Error('Inbox did not return a staff session.');
    return { ...result, data: await this.profile() };
  }
  async profile() {
    this.validated = false;
    const raw = await this.request<unknown>('/api/v1/profile');
    let profile: Profile;
    try {
      profile = boundStaffProfile(this.workspace, raw);
    } catch {
      this.dispose();
      this.onUnauthorized?.();
      throw new Error('Staff access changed.');
    }
    if (!this.session) throw new Error('Inbox did not return a staff session.');
    this.validated = true;
    this.onSession?.(this.session);
    return profile;
  }
  signOut() {
    this.validated = false;
    this.pending.forEach(controller => controller.abort());
    return this.request('/auth/sign_out', 'DELETE');
  }
  conversations(account: number, page: number, status: string) {
    return this.request<{ data: { payload: Conversation[] } }>(
      `/api/v1/accounts/${account}/conversations?status=${encodeURIComponent(status)}&assignee_type=all&page=${page}`,
    );
  }
  conversation(account: number, id: number) {
    return this.request<Conversation>(`/api/v1/accounts/${account}/conversations/${id}`);
  }
  messages(account: number, id: number, before?: number) {
    return this.request<{ payload: Message[] }>(
      `/api/v1/accounts/${account}/conversations/${id}/messages${before ? `?before=${before}` : ''}`,
    );
  }
  send(account: number, id: number, content: string, privateNote: boolean) {
    return this.request<Message>(
      `/api/v1/accounts/${account}/conversations/${id}/messages`,
      'POST',
      { content, message_type: 'outgoing', private: privateNote },
    );
  }
  status(account: number, id: number, status: string) {
    return this.request(`/api/v1/accounts/${account}/conversations/${id}/toggle_status`, 'POST', {
      status,
    });
  }
  assign(account: number, id: number, assignee_id: number | null) {
    return this.request(`/api/v1/accounts/${account}/conversations/${id}/assignments`, 'POST', {
      assignee_id,
    });
  }
  read(account: number, id: number) {
    return this.request(`/api/v1/accounts/${account}/conversations/${id}/update_last_seen`, 'POST');
  }
}
