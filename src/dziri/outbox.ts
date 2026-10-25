import type { ReplyPreview } from './api';
import type { UploadedMedia } from './media-upload';
export interface OutgoingDraft {
  id: string;
  body: string;
  createdAt: number;
  reply?: ReplyPreview;
  media?: UploadedMedia;
  status: 'pending' | 'sent' | 'failed';
}
// Retry the same immutable command, including its reply target and idempotency key.
export function createOutbox(
  transmit: (draft: OutgoingDraft) => Promise<unknown>,
  makeId: () => string,
  changed: (drafts: OutgoingDraft[]) => void,
  now = Date.now,
) {
  const drafts = new Map<string, OutgoingDraft>();
  const inFlight = new Set<string>();
  const emit = () => changed([...drafts.values()]);
  async function dispatch(id: string) {
    const draft = drafts.get(id);
    if (!draft || inFlight.has(id)) return;
    inFlight.add(id);
    drafts.set(id, { ...draft, status: 'pending' });
    emit();
    try {
      await transmit(draft);
      if (drafts.has(id)) drafts.set(id, { ...draft, status: 'sent' });
    } catch {
      if (drafts.has(id)) drafts.set(id, { ...draft, status: 'failed' });
    } finally {
      inFlight.delete(id);
      emit();
    }
  }
  return {
    enqueue(text: string, reply?: ReplyPreview) {
      const body = text.trim();
      if (!body || body.length > 8000 || drafts.size >= 20) return false;
      const id = makeId();
      drafts.set(id, { id, body, createdAt: now(), reply, status: 'pending' });
      void dispatch(id);
      return true;
    },
    enqueueMedia(media: UploadedMedia, text: string, reply?: ReplyPreview) {
      if (drafts.size >= 20 || text.trim().length > 8000) return false;
      const id = makeId();
      drafts.set(id, { id, body: text.trim(), media, reply, createdAt: now(), status: 'pending' });
      void dispatch(id);
      return true;
    },
    retry(id: string) {
      if (drafts.get(id)?.status === 'failed') void dispatch(id);
    },
    acknowledge(ids: string[]) {
      let removed = false;
      for (const id of ids) if (drafts.delete(id)) removed = true;
      if (removed) emit();
    },
  };
}
