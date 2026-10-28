import type { ReplyPreview } from './api';
import type { UploadedMedia } from './media-upload';
import {
  copyMarketplaceWriteScope,
  type MarketplaceWriteScope,
  copyPersonalWriteScope,
  personalWriteScopeKey,
  marketplaceWriteScopeKey,
  type PersonalWriteScope,
} from './message-writes.generated.ts';
export interface StickerSelection {
  id: string;
  uri: string;
}
export interface OutgoingDraft {
  id: string;
  body: string;
  createdAt: number;
  reply?: ReplyPreview;
  media?: UploadedMedia;
  sticker?: StickerSelection;
  status: 'pending' | 'sent' | 'failed';
  marketplaceScope?: MarketplaceWriteScope;
  personalScope?: PersonalWriteScope;
}
/** Status changes do not change the immutable command reviewed by the user. */
export function outgoingIntentKey(row: OutgoingDraft) {
  return JSON.stringify([
    row.id,
    row.body,
    row.createdAt,
    row.reply?.id,
    row.reply?.body,
    row.reply?.senderName,
    row.reply?.deleted,
    row.media?.storageId,
    row.media?.uri,
    row.media?.type,
    row.media?.mime,
    row.media?.size,
    row.media?.duration,
    row.media?.width,
    row.media?.height,
    row.media?.name,
    row.sticker?.id,
    row.sticker?.uri,
    row.personalScope ? personalWriteScopeKey(row.personalScope) : null,
    row.marketplaceScope ? marketplaceWriteScopeKey(row.marketplaceScope) : null,
  ]);
}
// Retry the same immutable command, including its reply target and idempotency key.
export function createOutbox(
  transmit: (draft: OutgoingDraft) => Promise<unknown>,
  makeId: () => string,
  changed: (drafts: OutgoingDraft[]) => void,
  now = Date.now,
  persist?: (drafts: OutgoingDraft[]) => Promise<unknown>,
  marketplaceScope?: MarketplaceWriteScope,
  personalScope?: PersonalWriteScope,
  removePersisted?: (expected: OutgoingDraft) => Promise<boolean>,
) {
  const capturedScope = marketplaceScope ? copyMarketplaceWriteScope(marketplaceScope) : undefined;
  const capturedPersonal = personalScope ? copyPersonalWriteScope(personalScope) : undefined;
  const drafts = new Map<string, OutgoingDraft>();
  const inFlight = new Map<string, number>();
  const discarding = new Set<string>();
  let active = true;
  let generation = 0;
  const current = (epoch: number) => active && generation === epoch;
  // Callers, presentation and transport receive snapshots, never the retained
  // command that must survive an acknowledgement loss and retry unchanged.
  const snapshot = (draft: OutgoingDraft): OutgoingDraft => ({
    ...draft,
    reply: draft.reply ? { ...draft.reply } : undefined,
    media: draft.media ? { ...draft.media } : undefined,
    sticker: draft.sticker ? { ...draft.sticker } : undefined,
    ...(draft.marketplaceScope
      ? { marketplaceScope: copyMarketplaceWriteScope(draft.marketplaceScope) }
      : {}),
    ...(draft.personalScope ? { personalScope: copyPersonalWriteScope(draft.personalScope) } : {}),
  });
  const emit = () => {
    if (active) changed([...drafts.values()].map(snapshot));
  };
  async function dispatch(id: string) {
    const draft = drafts.get(id);
    if (!active || !draft || inFlight.has(id) || discarding.has(id)) return;
    const epoch = generation;
    inFlight.set(id, epoch);
    drafts.set(id, { ...draft, status: 'pending' });
    emit();
    try {
      if (persist) await persist([...drafts.values()].map(snapshot));
      if (!current(epoch) || !drafts.has(id)) return;
      await transmit(snapshot(draft));
      if (current(epoch) && drafts.has(id)) drafts.set(id, { ...draft, status: 'sent' });
    } catch {
      if (current(epoch) && drafts.has(id)) drafts.set(id, { ...draft, status: 'failed' });
    } finally {
      if (inFlight.get(id) === epoch) inFlight.delete(id);
      if (current(epoch)) emit();
    }
  }
  return {
    activate() {
      if (active) return;
      active = true;
      emit();
    },
    deactivate() {
      if (!active) return;
      active = false;
      generation += 1;
      inFlight.clear();
      // Interrupted commands remain recoverable, but resuming never sends them.
      for (const [id, draft] of drafts)
        if (draft.status === 'pending') drafts.set(id, { ...draft, status: 'failed' });
    },
    restore(saved: OutgoingDraft[]) {
      for (const draft of saved.slice(0, 20)) {
        if (!drafts.has(draft.id)) drafts.set(draft.id, snapshot({ ...draft, status: 'failed' }));
      }
      emit();
    },
    enqueue(text: string, reply?: ReplyPreview) {
      const body = text.trim();
      if (!active || !body || body.length > 8000 || drafts.size >= 20) return false;
      const id = makeId();
      drafts.set(
        id,
        snapshot({
          id,
          body,
          createdAt: now(),
          reply,
          status: 'pending',
          ...(capturedScope ? { marketplaceScope: capturedScope } : {}),
          ...(capturedPersonal ? { personalScope: capturedPersonal } : {}),
        }),
      );
      void dispatch(id);
      return true;
    },
    enqueueMedia(media: UploadedMedia, text: string, reply?: ReplyPreview) {
      if (!active || drafts.size >= 20 || text.trim().length > 8000) return false;
      const id = makeId();
      drafts.set(
        id,
        snapshot({
          id,
          body: text.trim(),
          media,
          reply,
          createdAt: now(),
          status: 'pending',
          ...(capturedScope ? { marketplaceScope: capturedScope } : {}),
          ...(capturedPersonal ? { personalScope: capturedPersonal } : {}),
        }),
      );
      void dispatch(id);
      return true;
    },
    enqueueSticker(sticker: StickerSelection, reply?: ReplyPreview) {
      if (!active || drafts.size >= 20) return false;
      const id = makeId();
      drafts.set(
        id,
        snapshot({
          id,
          body: '',
          sticker: { ...sticker },
          reply,
          createdAt: now(),
          status: 'pending',
        }),
      );
      void dispatch(id);
      return true;
    },
    retry(id: string) {
      if (drafts.get(id)?.status === 'failed') void dispatch(id);
    },
    async discard(expected: OutgoingDraft) {
      const row = drafts.get(expected.id),
        epoch = generation;
      if (
        !active ||
        !row ||
        row.status !== 'failed' ||
        inFlight.has(row.id) ||
        discarding.has(row.id) ||
        outgoingIntentKey(row) !== outgoingIntentKey(expected) ||
        (persist && !removePersisted)
      )
        return false;
      discarding.add(row.id);
      try {
        if (removePersisted && !(await removePersisted(snapshot(row)))) return false;
        if (!current(epoch)) return false;
        const latest = drafts.get(row.id);
        if (!latest) return true;
        if (outgoingIntentKey(latest) !== outgoingIntentKey(row) || latest.status !== 'failed')
          return false;
        drafts.delete(row.id);
        emit();
        return true;
      } catch {
        return false;
      } finally {
        discarding.delete(row.id);
      }
    },
    acknowledge(ids: string[]) {
      let removed = false;
      for (const id of ids) if (drafts.delete(id)) removed = true;
      if (removed) emit();
    },
  };
}
