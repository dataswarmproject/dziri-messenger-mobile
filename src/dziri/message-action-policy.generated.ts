// Canonical client affordances. Authenticated server checks remain authoritative.
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
export const MESSAGE_TEXT_LIMIT = 8000;
export const MESSAGE_QUICK_REACTIONS = ['❤️', '😆', '😮', '😢', '😡', '👍'] as const;
export type GroupMemberAction = 'remove' | 'promote' | 'demote' | 'transfer';
export function groupMemberActions(
  actorRole: string,
  targetRole: string,
  self: boolean,
  writable: boolean,
  available: boolean,
): GroupMemberAction[] {
  if (!writable || self || targetRole === 'owner' || !['owner', 'admin'].includes(actorRole))
    return [];
  const actions: GroupMemberAction[] = [];
  if (actorRole === 'owner' && available)
    actions.push(targetRole === 'admin' ? 'demote' : 'promote', 'transfer');
  if (actorRole === 'owner' || targetRole !== 'admin') actions.push('remove');
  return actions;
}

export interface MessageActionTarget {
  mine: boolean;
  type: string;
  body?: string;
  createdAt: number;
  immutable?: boolean;
  local?: boolean;
  deleted?: boolean;
  writable?: boolean;
}

export function messageActionAvailability(target: MessageActionTarget, now = Date.now()) {
  const persistedOwn =
    target.mine &&
    !target.local &&
    !target.deleted &&
    !target.immutable &&
    target.writable !== false;
  const age = now - target.createdAt;
  return {
    copy: !target.deleted && target.type !== 'unsupported' && !!target.body?.trim(),
    edit:
      persistedOwn &&
      target.type === 'text' &&
      target.body !== undefined &&
      Number.isFinite(age) &&
      age >= 0 &&
      age <= MESSAGE_EDIT_WINDOW_MS,
    remove: persistedOwn,
  };
}

export function editedMessageText(draft: string, previous?: string): string | null {
  const text = draft.trim();
  return text.length > 0 && text.length <= MESSAGE_TEXT_LIMIT && text !== previous?.trim()
    ? text
    : null;
}
