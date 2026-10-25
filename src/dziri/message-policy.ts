import type { MessageRecord, ThreadDetail } from './api';
import type { MessageMedia } from './media-preview';

export function canSendText(thread: ThreadDetail): boolean {
  return (
    !thread.isFrozen &&
    thread.encryption !== 'e2ee' &&
    !(thread.isReadOnly && thread.myRole === 'subscriber')
  );
}

export function messageText(
  message: MessageRecord,
  labels: { deleted: string; unsupported: string; encryptionUnavailable: string },
): string {
  if (message.deletedAt !== undefined) return labels.deleted;
  if (message.ciphertext !== undefined) return labels.encryptionUnavailable;
  return message.type === 'text' && message.body !== undefined ? message.body : labels.unsupported;
}

export function storedReceipt(message: MessageRecord, myId: string, peerReadAt?: number) {
  if (message.senderId !== myId || message.deletedAt !== undefined) return null;
  return peerReadAt !== undefined && peerReadAt >= message.createdAt ? 'seen' : 'sent';
}

export type DeliveryState = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export function displayMedia(message: MessageRecord): MessageMedia | undefined {
  if (
    message.deletedAt !== undefined ||
    message.ciphertext ||
    message.moderationStatus === 'blocked' ||
    message.moderationStatus === 'blurred' ||
    !message.mediaUrl
  )
    return undefined;
  const type = message.type;
  if (
    type === 'image' ||
    type === 'video' ||
    type === 'voice' ||
    type === 'sticker' ||
    type === 'gif' ||
    type === 'file'
  )
    return {
      uri: message.mediaUrl,
      type,
      mime: message.mediaMime,
      duration: message.mediaDurationMs,
    };
  return undefined;
}
// Match Consumer's receipt semantics: group ticks require every original recipient.
export function deliveryState(
  createdAt: number,
  readAt?: number,
  deliveredAt?: number,
  recipients?: { joinedAt: number; readAt?: number; deliveredAt?: number }[],
): DeliveryState {
  if (recipients) {
    const original = recipients.filter(r => r.joinedAt <= createdAt);
    if (!original.length) return 'sent';
    if (original.every(r => (r.readAt ?? -1) >= createdAt)) return 'read';
    if (original.every(r => Math.max(r.readAt ?? -1, r.deliveredAt ?? -1) >= createdAt))
      return 'delivered';
    return 'sent';
  }
  if (readAt !== undefined && readAt >= createdAt) return 'read';
  if (deliveredAt !== undefined && deliveredAt >= createdAt) return 'delivered';
  return 'sent';
}
