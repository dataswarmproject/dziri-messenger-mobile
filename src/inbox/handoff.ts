import { staffWorkspaceKey, type StaffWorkspace } from '../dziri/messenger-staff.generated';
import type { Session } from './client';

export type HandoffTicket = { cipher: string; iv: string; keyVersion: number };
export type PendingHandoff = {
  version: 1;
  scope: string;
  ticket: HandoffTicket;
  expiresAt: number;
};
export const sameHandoff = (a: PendingHandoff, b: PendingHandoff) =>
  a.version === b.version &&
  a.scope === b.scope &&
  a.expiresAt === b.expiresAt &&
  a.ticket.cipher === b.ticket.cipher &&
  a.ticket.iv === b.ticket.iv &&
  a.ticket.keyVersion === b.ticket.keyVersion;
type Factor = { otpCode: string; backupCode?: never } | { backupCode: string; otpCode?: never };
export type HandoffExchangeRequest = {
  ticket: HandoffTicket;
  phase: 'begin' | 'verify' | 'cancel';
  challenge?: string;
  otpCode?: string;
  backupCode?: string;
};
type Result = { state: string; expiresAt?: number };
export type HandoffPorts = {
  prepare: () => Promise<unknown>;
  exchange: (request: HandoffExchangeRequest) => Promise<unknown>;
  load: () => Promise<PendingHandoff | null>;
  save: (pending: PendingHandoff | null, expected?: PendingHandoff) => Promise<void>;
  /** Must validate the provider profile and persist only in the isolated staff vault. */
  accept: (session: Session) => Promise<void>;
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const states = new Set([
  'disabled',
  'reauthenticate',
  'authority_changed',
  'unavailable',
  'invalid_attempt',
  'transport_failed',
  'revocation_unconfirmed',
  'restart_required',
  'federated_auth_required',
  'security_setup_required',
  'challenge_failed',
  'challenge_exhausted',
  'session_limit',
  'rate_limited',
]);
/** Staff-only recoverable handoff; no personal store, credential link or implicit background retry. */
export class StaffHandoff {
  private generation = 0;
  private closed = false;
  private busy = false;
  private challenge = '';
  private pending: PendingHandoff | null = null;
  private readonly scope: string;
  constructor(
    private readonly workspace: StaffWorkspace,
    private readonly ports: HandoffPorts,
  ) {
    this.scope = staffWorkspaceKey(workspace);
  }
  dispose() {
    this.closed = true;
    this.generation++;
    this.challenge = '';
  }
  private active(generation: number) {
    return !this.closed && generation === this.generation;
  }
  private async cleanup(pending: PendingHandoff): Promise<Result> {
    try {
      const reply = await this.ports.exchange({ ticket: pending.ticket, phase: 'cancel' });
      if (!record(reply) || reply.state !== 'cancelled') return { state: 'revocation_unconfirmed' };
      // Never clear a newer attempt that may have replaced this one during an await.
      const stored = await this.ports.load();
      if (stored && sameHandoff(stored, pending)) await this.ports.save(null, pending);
      if (this.pending === pending) this.pending = null;
      return { state: 'cancelled' };
    } catch {
      return { state: 'revocation_unconfirmed' };
    }
  }
  async cancel(): Promise<Result> {
    this.generation++;
    this.challenge = '';
    try {
      const pending = this.pending ?? (await this.ports.load());
      if (!pending) return { state: 'cancelled' };
      if (pending.scope !== this.scope) return { state: 'authority_changed' };
      return this.cleanup(pending);
    } catch {
      return { state: 'storage_failed' };
    }
  }
  async start(): Promise<Result> {
    return this.run('start');
  }
  async resume(): Promise<Result> {
    return this.run('resume');
  }
  async verify(factor: Factor): Promise<Result> {
    return this.run('verify', factor);
  }
  private async run(mode: 'start' | 'resume' | 'verify', factor?: Factor): Promise<Result> {
    if (this.closed) return { state: 'cancelled' };
    if (this.busy) return { state: 'busy' };
    this.busy = true;
    const generation = this.generation;
    try {
      let pending: PendingHandoff | null;
      try {
        pending = this.pending ?? (await this.ports.load());
      } catch {
        return { state: 'storage_failed' };
      }
      if (!this.active(generation)) return { state: 'cancelled' };
      if (mode === 'start') {
        if (pending) return { state: 'review_required' };
        let reply: unknown;
        try {
          reply = await this.ports.prepare();
        } catch {
          return { state: 'transport_failed' };
        }
        if (!this.active(generation)) return { state: 'cancelled' };
        if (!record(reply)) return { state: 'unavailable' };
        if (reply.state !== 'prepared')
          return {
            state:
              typeof reply.state === 'string' && states.has(reply.state)
                ? reply.state
                : 'unavailable',
          };
        if (
          !record(reply.ticket) ||
          typeof reply.ticket.cipher !== 'string' ||
          reply.ticket.cipher.length > 8192 ||
          typeof reply.ticket.iv !== 'string' ||
          !/^[A-Za-z0-9_-]{16}$/.test(reply.ticket.iv) ||
          reply.ticket.keyVersion !== 1 ||
          typeof reply.expiresAt !== 'number' ||
          !Number.isSafeInteger(reply.expiresAt) ||
          reply.expiresAt <= Date.now() ||
          reply.expiresAt > Date.now() + 300_000
        )
          return { state: 'unavailable' };
        pending = {
          version: 1,
          scope: this.scope,
          ticket: { cipher: reply.ticket.cipher, iv: reply.ticket.iv, keyVersion: 1 },
          expiresAt: reply.expiresAt,
        };
        try {
          await this.ports.save(pending);
        } catch {
          return { state: 'storage_failed' };
        }
      }
      if (!pending) return { state: 'restart_required' };
      if (pending.scope !== this.scope || pending.version !== 1)
        return { state: 'authority_changed' };
      this.pending = pending;
      if (!this.active(generation) || pending.expiresAt <= Date.now()) return this.cleanup(pending);
      if (
        mode === 'verify' &&
        (!this.challenge ||
          !factor ||
          !(
            ('otpCode' in factor &&
              /^\d{6}$/.test(factor.otpCode ?? '') &&
              factor.backupCode === undefined) ||
            ('backupCode' in factor &&
              /^[A-F0-9]{8}$/.test(factor.backupCode ?? '') &&
              factor.otpCode === undefined)
          ))
      )
        return { state: 'invalid_attempt' };
      let result: unknown;
      try {
        result = await this.ports.exchange({
          ticket: pending.ticket,
          phase: mode === 'verify' ? 'verify' : 'begin',
          ...(mode === 'verify' ? { challenge: this.challenge, ...factor } : {}),
        });
      } catch {
        return this.active(generation) ? { state: 'transport_failed' } : this.cleanup(pending);
      }
      if (!this.active(generation)) return this.cleanup(pending);
      if (!record(result)) return this.cleanup(pending);
      if (
        result.state === 'mfa_required' &&
        typeof result.challenge === 'string' &&
        /^[a-f0-9]{64}$/.test(result.challenge) &&
        typeof result.expires_at === 'number' &&
        result.expires_at * 1000 > Date.now()
      ) {
        this.challenge = result.challenge;
        return { state: 'mfa_required', expiresAt: result.expires_at * 1000 };
      }
      if (result.state !== 'ready')
        return typeof result.state === 'string' && states.has(result.state)
          ? { state: result.state }
          : this.cleanup(pending);
      const auth = result.auth;
      if (
        !record(auth) ||
        typeof auth.accessToken !== 'string' ||
        !/^[A-Za-z0-9_-]{1,512}$/.test(auth.accessToken) ||
        typeof auth.client !== 'string' ||
        !/^[A-Za-z0-9_-]{1,512}$/.test(auth.client) ||
        auth.uid !== this.workspace.email ||
        result.user_id !== this.workspace.remoteUserId ||
        result.account_id !== this.workspace.accountId ||
        result.inbox_id !== this.workspace.inboxId ||
        result.authority_key !== this.workspace.authorityKey ||
        typeof result.expires_at !== 'number' ||
        result.expires_at * 1000 <= Date.now()
      )
        return this.cleanup(pending);
      try {
        await this.ports.accept({
          'access-token': auth.accessToken,
          client: auth.client,
          uid: this.workspace.email,
        });
      } catch {
        return this.cleanup(pending);
      }
      if (!this.active(generation)) return this.cleanup(pending);
      this.challenge = '';
      return { state: 'ready' };
    } finally {
      this.busy = false;
    }
  }
}
