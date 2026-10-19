export type Session = { 'access-token': string; client: string; uid: string };
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
  readonly origin: string;
  private fetcher: typeof fetch;
  private base: string;
  onSession?: (session: Session) => void;
  onUnauthorized?: () => void;

  constructor(origin: string, fetcher: typeof fetch = fetch, base = origin) {
    this.origin = origin;
    this.fetcher = fetcher.bind(globalThis);
    this.base = base;
  }
  setSession(session: Session) {
    this.session = session;
  }
  dispose() {
    this.closed = true;
    this.pending.forEach(controller => controller.abort());
    this.pending.clear();
    this.session = null;
  }
  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (this.closed) throw new Error('Inbox session is closed');
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
      if (response.status === 401) this.onUnauthorized?.();
      if (!response.ok) throw new InboxError(response.status);
      const token = response.headers.get('access-token');
      const client = response.headers.get('client');
      const uid = response.headers.get('uid');
      if (token && client && uid && sequence >= this.rotatedAt) {
        this.rotatedAt = sequence;
        this.session = { 'access-token': token, client, uid };
        this.onSession?.(this.session);
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
  ) {
    const result = await this.request<{
      data?: Profile;
      mfa_required?: boolean;
      mfa_token?: string;
      mfa_setup_required?: boolean;
    }>('/auth/sign_in', 'POST', credentials);
    if (result.mfa_required || result.mfa_setup_required) return result;
    if (!result.data || !this.session) throw new Error('Inbox did not return a staff session.');
    return result;
  }
  profile() {
    return this.request<Profile>('/api/v1/profile');
  }
  signOut() {
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
