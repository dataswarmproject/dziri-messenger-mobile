import { makeFunctionReference, type PaginationResult } from 'convex/server';
import type { PaginationOptions } from 'convex/server';
import type { MessengerCapabilities } from '../messenger-policy';

export interface CommerceSummary {
  _id: string;
  storeId?: string;
  title: string;
  context: string;
  lastMessagePreview: string;
  lastMessageAt: number;
}

export interface CommerceMessage {
  _id: string;
  senderId: string;
  content: string;
  createdAt: number;
  deletedAt?: number;
}

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
  capabilities: makeFunctionReference<'query', Record<string, never>, MessengerCapabilities | null>(
    'messaging/messenger:capabilities',
  ),
  laneThreads: makeFunctionReference<'query', { lane: 'friends' | 'staff' }, ThreadSummary[]>(
    'messaging/messenger:listThreads',
  ),
  commerce: makeFunctionReference<'query', { lane: 'friends' | 'customers' }, CommerceSummary[]>(
    'messaging/messenger:listCommerce',
  ),
  commerceDetail: makeFunctionReference<
    'query',
    { conversationId: string; storeId?: string },
    { otherName: string; storeName: string } | null
  >('marketplaceMessages:getConversation'),
  commerceMessages: makeFunctionReference<
    'query',
    { conversationId: string; storeId?: string; limit: number },
    CommerceMessage[]
  >('marketplaceMessages:listMessages'),
  commerceSend: makeFunctionReference<
    'mutation',
    { conversationId: string; storeId?: string; content: string; clientMessageId: string },
    number
  >('marketplaceMessages:sendMessage'),
  commerceRead: makeFunctionReference<
    'mutation',
    { conversationId: string; storeId?: string },
    null
  >('marketplaceMessages:markConversationAsRead'),
  supportAvailability: makeFunctionReference<
    'query',
    { companyId: string },
    { name: string; available: boolean } | null
  >('inbox/service:supportAvailability'),
  startSupport: makeFunctionReference<
    'mutation',
    { companyId: string; consent: boolean },
    { threadId: string; connectionId: string }
  >('inbox/service:startSupport'),
  supportConnection: makeFunctionReference<
    'query',
    { threadId: string },
    { connectionId: string; connected: boolean; ready: boolean; orderId: string | null } | null
  >('inbox/service:connectionStatus'),
  stopSharing: makeFunctionReference<'mutation', { connectionId: string }, null>(
    'inbox/service:disconnect',
  ),
  me: makeFunctionReference<'query', Record<string, never>, { _id: string; name?: string } | null>(
    'users:getMe',
  ),
  threads: makeFunctionReference<'query', Record<string, never>, ThreadSummary[]>(
    'messaging/threads:listMyThreads',
  ),
  thread: makeFunctionReference<'query', { threadId: string }, ThreadDetail | null>(
    'messaging/messenger:thread',
  ),
  messages: makeFunctionReference<
    'query',
    { threadId: string; paginationOpts: PaginationOptions },
    PaginationResult<MessageRecord>
  >('messaging/messenger:messages'),
  sendText: makeFunctionReference<
    'mutation',
    { threadId: string; body: string; clientMessageId: string },
    string
  >('messaging/messenger:sendText'),
  markRead: makeFunctionReference<'mutation', { threadId: string; messageId: string }, null>(
    'messaging/messenger:markRead',
  ),
};
