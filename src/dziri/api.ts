import { makeFunctionReference, type PaginationResult } from 'convex/server';
import type { PaginationOptions } from 'convex/server';

// Narrow public contract for the existing backend, not another backend/schema.
// IDs stay canonical strings; all access is enforced by the authenticated server.
export interface ThreadSummary {
  _id: string;
  type: string;
  title?: string;
  avatarUrl?: string;
  encryption: string;
  isFrozen: boolean;
  lastMessageAt: number;
  lastMessagePreview?: string;
  unreadCount: number;
  otherUser?: { _id: string; name?: string; handle?: string; image?: string };
  myRole: string;
}

export interface ThreadDetail {
  _id: string;
  type: string;
  title?: string;
  avatarUrl?: string;
  encryption: string;
  isFrozen: boolean;
  isReadOnly: boolean;
  myRole: string;
  peerReadAt?: number;
}

export interface MessageRecord {
  _id: string;
  threadId: string;
  senderId: string;
  senderName?: string;
  type: string;
  body?: string;
  ciphertext?: string;
  createdAt: number;
  deletedAt?: number;
}

export const dziriApi = {
  me: makeFunctionReference<'query', Record<string, never>, { _id: string; name?: string } | null>(
    'users:getMe',
  ),
  threads: makeFunctionReference<'query', Record<string, never>, ThreadSummary[]>(
    'messaging/threads:listMyThreads',
  ),
  thread: makeFunctionReference<'query', { threadId: string }, ThreadDetail | null>(
    'messaging/threads:getThread',
  ),
  messages: makeFunctionReference<
    'query',
    { threadId: string; paginationOpts: PaginationOptions },
    PaginationResult<MessageRecord>
  >('messaging/messages:listMessages'),
  sendText: makeFunctionReference<
    'mutation',
    { threadId: string; body: string; clientMessageId: string },
    string
  >('messaging/messages:sendText'),
  markRead: makeFunctionReference<'mutation', { threadId: string; messageId: string }, null>(
    'messaging/threads:markRead',
  ),
};
