interface GroupMessage {
  senderId: string;
  createdAt: number;
  deleted?: boolean;
  local?: boolean;
}

// History is newest-first; before/after refer to chronological bubble edges.
export function messageGroups(messages: readonly GroupMessage[], index: number) {
  const current = messages[index];
  if (!current || current.deleted || current.local) return { before: false, after: false };
  const joins = (near: GroupMessage | undefined) =>
    !!near &&
    !near.deleted &&
    !near.local &&
    near.senderId === current.senderId &&
    Math.abs(near.createdAt - current.createdAt) < 300_000 &&
    new Date(near.createdAt).toDateString() === new Date(current.createdAt).toDateString();
  return { before: joins(messages[index + 1]), after: joins(messages[index - 1]) };
}
