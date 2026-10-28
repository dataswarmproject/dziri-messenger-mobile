export const RECEIPT_VIEW_AREA_PERCENT = 80;
export const RECEIPT_READ_DWELL_MS = 500;

/** Short items must fit completely; oversized items can fill the viewport. */
export function receiptIsViewable(visible: number, item: number, viewport: number) {
  if (![visible, item, viewport].every(value => Number.isFinite(value) && value > 0)) return false;
  const clipped = Math.min(visible, item, viewport);
  return clipped === item || clipped / viewport >= RECEIPT_VIEW_AREA_PERCENT / 100;
}

/** IntersectionObserver uses item-relative thresholds, including for tall cells. */
export function receiptIntersectionThreshold(item: number, viewport: number) {
  if (![item, viewport].every(value => Number.isFinite(value) && value > 0) || item <= viewport)
    return 1;
  return (viewport * RECEIPT_VIEW_AREA_PERCENT) / 100 / item;
}

export type ReceiptScope = {
  actorId: string;
  threadId: string;
  epoch: number;
  revision: number;
  readGeneration: number;
};
export type ReceiptSummary = ReceiptScope & {
  tracked: boolean;
  ready: boolean;
  count: number | null;
};
export type ReceiptCommand = {
  expectedActorId: string;
  threadId: string;
  epoch: number;
  revision: number;
  readGeneration: number;
  kind: 'read' | 'delivered';
  messageIds: string[];
};
type Kind = ReceiptCommand['kind'];
export type MarketplaceReceiptContext = {
  expectedActorId: string;
  readGeneration: number;
  authorityKey: string;
};
export type MarketplaceReceiptPayload = {
  conversationId: string;
  storeId?: string;
  companyId?: string;
  messageIds: string[];
  observation: MarketplaceReceiptContext;
};
export type MarketplaceInboxSource = Omit<MarketplaceReceiptPayload, 'messageIds'>;
export type MarketplaceReactionInbox = MarketplaceInboxSource & {
  headId: string | null;
};
export function marketplaceInboxKey(source?: MarketplaceInboxSource | null) {
  return source
    ? JSON.stringify([
        source.conversationId,
        source.storeId ?? null,
        source.companyId ?? null,
        source.observation.expectedActorId,
        source.observation.readGeneration,
        source.observation.authorityKey,
      ])
    : '';
}
/** Domain-scoped observer identity contains the full durable grant key. It is
 * local transport identity, never a personal thread ID or a grant of authority. */
export function createMarketplaceReceiptAdapter(
  options: {
    actorId?: string;
    conversationId: string;
    storeId?: string;
    companyId?: string;
    context?: MarketplaceReceiptContext | null;
  },
  send: (kind: Kind, payload: MarketplaceReceiptPayload) => Promise<unknown>,
) {
  const { actorId, conversationId, storeId, companyId, context } = options;
  const observation = context ? { ...context } : null;
  const scope: ReceiptScope | null =
    actorId &&
    observation?.expectedActorId === actorId &&
    /^v1:[a-f0-9]{64}$/.test(observation.authorityKey) &&
    Number.isSafeInteger(observation.readGeneration) &&
    observation.readGeneration >= 0
      ? {
          actorId,
          threadId: JSON.stringify([
            'marketplace',
            conversationId,
            storeId ?? null,
            observation.authorityKey,
            ...(companyId ? [companyId] : []),
          ]),
          epoch: 0,
          revision: 0,
          readGeneration: observation.readGeneration,
        }
      : null;
  const key = receiptScopeKey(scope);
  return {
    scope,
    marketplace:
      scope && observation
        ? Object.freeze({
            conversationId,
            ...(storeId ? { storeId } : {}),
            ...(companyId ? { companyId } : {}),
            observation: Object.freeze({ ...observation }),
          })
        : null,
    async send(command: ReceiptCommand) {
      if (
        !scope ||
        !observation ||
        receiptScopeKey({ ...command, actorId: command.expectedActorId }) !== key
      )
        throw new Error('Stale observation');
      return send(command.kind, {
        conversationId,
        ...(storeId ? { storeId } : {}),
        ...(companyId ? { companyId } : {}),
        messageIds: command.messageIds,
        observation: { ...observation },
      });
    },
  };
}
/** Private conversation-view activity. No message IDs and no public-read evidence.
 * Head changes coalesce behind one request; scope/focus loss invalidates late responses. */
export function createReactionInboxObserver(
  send: (source: MarketplaceInboxSource) => Promise<{ more: boolean }>,
) {
  let source: MarketplaceInboxSource | null = null,
    key = '',
    active = false,
    disposed = false,
    version = 0,
    head: string | null = null,
    completed: string | null = null,
    ready = false,
    flight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  function cancel() {
    version++;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    flight = false;
    ready = false;
    completed = null;
  }
  function schedule(delay: number) {
    if (disposed || !source || !active || !head || head === completed || flight || timer !== null)
      return;
    const stamp = version;
    timer = setTimeout(() => {
      timer = null;
      if (disposed || stamp !== version || !active || !source || !head) return;
      ready = true;
      flight = true;
      const sentHead = head,
        captured = source;
      Promise.resolve()
        .then(() => {
          if (disposed || stamp !== version || !active) return null;
          return send(captured);
        })
        .then(result => {
          if (!result || disposed || stamp !== version) return;
          flight = false;
          completed = result.more ? null : sentHead;
          schedule(0);
        })
        .catch(() => {
          if (disposed || stamp !== version) return;
          flight = false;
          schedule(1000);
        });
    }, delay);
  }
  return {
    configure(next: MarketplaceInboxSource | null, enabled: boolean, nextHead: string | null) {
      if (disposed) return;
      const nextKey = marketplaceInboxKey(next),
        nextActive = !!next && enabled;
      if (key !== nextKey || active !== nextActive) cancel();
      key = nextKey;
      source = next ? { ...next, observation: { ...next.observation } } : null;
      active = nextActive;
      head = nextHead;
      if (!head && timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      schedule(ready ? 0 : RECEIPT_READ_DWELL_MS);
    },
    dispose() {
      disposed = true;
      active = false;
      source = null;
      cancel();
    },
  };
}
export function receiptScopeKey(scope?: ReceiptScope | null) {
  return scope
    ? JSON.stringify([
        scope.actorId,
        scope.threadId,
        scope.epoch,
        scope.revision,
        scope.readGeneration,
      ])
    : '';
}
/** Shared exact-ID lifecycle. Adapters supply actual received/viewable incoming IDs. */
export function createReceiptObserver(send: (command: ReceiptCommand) => Promise<unknown>) {
  let scope: ReceiptScope | null = null,
    active = false,
    disposed = false,
    stamp = 0;
  let received = new Set<string>(),
    visible = new Set<string>(),
    blocked = new Set<string>();
  const known = { read: new Set<string>(), delivered: new Set<string>() };
  const ready = new Set<string>(),
    dwell = new Map<string, ReturnType<typeof setTimeout>>();
  const flights: Record<Kind, object | null> = { read: null, delivered: null };
  const retries: Record<Kind, ReturnType<typeof setTimeout> | null> = {
    read: null,
    delivered: null,
  };
  function cancel() {
    stamp++;
    for (const timer of dwell.values()) clearTimeout(timer);
    dwell.clear();
    ready.clear();
    for (const kind of ['read', 'delivered'] as const) {
      if (retries[kind] !== null) clearTimeout(retries[kind]);
      retries[kind] = null;
      flights[kind] = null;
    }
  }
  function drive(kind: Kind) {
    if (disposed || !active || !scope || flights[kind] || retries[kind] !== null) return;
    const candidates =
      kind === 'read'
        ? [...ready].filter(id => visible.has(id) && !blocked.has(id))
        : [...received];
    const messageIds = candidates.filter(id => !known[kind].has(id)).slice(0, 100);
    if (!messageIds.length) return;
    const token = {},
      version = stamp;
    flights[kind] = token;
    const command: ReceiptCommand = {
      expectedActorId: scope.actorId,
      threadId: scope.threadId,
      epoch: scope.epoch,
      revision: scope.revision,
      readGeneration: scope.readGeneration,
      kind,
      messageIds,
    };
    Promise.resolve()
      .then(() => {
        if (disposed || !active || stamp !== version || flights[kind] !== token) return false;
        return send(command).then(() => true);
      })
      .then(sent => {
        if (!sent || disposed || stamp !== version || flights[kind] !== token) return;
        messageIds.forEach(id => known[kind].add(id));
        flights[kind] = null;
        drive(kind);
      })
      .catch(() => {
        if (disposed || stamp !== version || flights[kind] !== token) return;
        flights[kind] = null;
        retries[kind] = setTimeout(() => {
          retries[kind] = null;
          drive(kind);
        }, 1000);
      });
  }
  function observe() {
    if (disposed || !active || !scope) return;
    for (const id of visible) {
      if (known.read.has(id) || ready.has(id) || blocked.has(id) || dwell.has(id)) continue;
      const version = stamp;
      dwell.set(
        id,
        setTimeout(() => {
          dwell.delete(id);
          if (disposed || !active || version !== stamp || !visible.has(id) || blocked.has(id))
            return;
          ready.add(id);
          drive('read');
        }, RECEIPT_READ_DWELL_MS),
      );
    }
  }
  return {
    configure(next: ReceiptScope | null, enabled: boolean) {
      if (disposed) return;
      const identity = (s: ReceiptScope | null) =>
        s ? JSON.stringify([s.actorId, s.threadId, s.epoch]) : '';
      const changed = identity(scope) !== identity(next),
        revision = receiptScopeKey(scope) !== receiptScopeKey(next);
      const nextActive = !!next && enabled;
      if (!changed && !revision && active === nextActive) return;
      const wasActive = active;
      cancel();
      if (changed) {
        known.read.clear();
        known.delivered.clear();
        received = new Set();
        visible = new Set();
        blocked.clear();
      } else if (revision) {
        known.read.clear();
        blocked = new Set(visible);
      }
      scope = next;
      active = nextActive;
      if (active && !wasActive) blocked.clear();
      drive('delivered');
      observe();
    },
    received(ids: readonly string[]) {
      if (disposed) return;
      received = new Set(ids);
      drive('delivered');
    },
    visible(ids: readonly string[]) {
      if (disposed) return;
      visible = new Set(ids);
      for (const id of blocked) if (!visible.has(id)) blocked.delete(id);
      for (const [id, timer] of dwell)
        if (!visible.has(id)) {
          clearTimeout(timer);
          dwell.delete(id);
        }
      for (const id of ready) if (!visible.has(id)) ready.delete(id);
      observe();
    },
    dispose() {
      disposed = true;
      active = false;
      cancel();
      received.clear();
      visible.clear();
      blocked.clear();
    },
  };
}
