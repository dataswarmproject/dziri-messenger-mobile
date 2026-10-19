import type { MessageRecord, ThreadDetail } from './api';

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
