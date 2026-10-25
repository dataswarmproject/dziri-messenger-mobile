import { makeFunctionReference, type PaginationResult } from 'convex/server';
import type { PaginationOptions } from 'convex/server';
import type { MessengerCapabilities } from '../messenger-policy';

export interface CommerceSummary {
  _id: string;
  storeId?: string;
  side: 'buying' | 'selling';
  avatarUrl?: string;
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
  clientMessageId?: string;
  senderName: string;
  senderImage?: string | null;
  senderSide: 'buyer' | 'seller';
  deliveredAt?: number;
  receiptReadAt?: number;
  parentMessageId?: string;
  parentContent?: string | null;
  parentSenderName?: string;
  parentDeleted?: boolean;
  reactions: { emoji: string; userId: string }[];
  imageUrls?: string[];
}

export interface ReplyPreview {
  id: string;
  senderName?: string;
  body?: string;
  deleted: boolean;
}
export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}
export interface ChatPerson {
  userId: string;
  name?: string;
  handle?: string;
  image?: string;
  isOnline: boolean;
}
export interface StoryRecord {
  _id: string;
  authorId: string;
  authorName?: string;
  authorHandle?: string;
  authorImage?: string;
  type: string;
  mediaUrl?: string;
  mediaThumbUrl?: string;
  mediaDurationMs?: number;
  body?: string;
  backgroundHex?: string;
  expiresAt: number;
  createdAt: number;
  iHaveViewed: boolean;
  moderationStatus: string;
}
export interface MessengerPreferences {
  activityStatus: boolean;
  lastSeen: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
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
  mutedUntil?: number;
  peerDeliveredAt?: number;
  deliveryReceiptsEnabled: boolean;
  recipientReceipts: { joinedAt: number; readAt?: number; deliveredAt?: number }[];
}

export interface MessageRecord {
  _id: string;
  threadId: string;
  senderId: string;
  senderName?: string;
  senderImage?: string;
  clientMessageId?: string;
  replyToMessageId?: string;
  replyPreview?: ReplyPreview;
  reactionSummary: ReactionSummary[];
  mediaUrl?: string;
  mediaMime?: string;
  mediaDurationMs?: number;
  moderationStatus?: string;
  type: string;
  body?: string;
  ciphertext?: string;
  createdAt: number;
  deletedAt?: number;
}

export const dziriApi = {
  stories: makeFunctionReference<'query', Record<string, never>, StoryRecord[]>(
    'messaging/stories:listFollowing',
  ),
  storyView: makeFunctionReference<'mutation', { storyId: string }, null>(
    'messaging/stories:recordView',
  ),
  storyCreate: makeFunctionReference<
    'mutation',
    {
      type: 'photo' | 'video' | 'text' | 'voice';
      body?: string;
      mediaStorageId?: string;
      mediaDurationMs?: number;
      audience: 'followers';
    },
    string
  >('messaging/stories:create'),
  uploadUrl: makeFunctionReference<'mutation', Record<string, never>, string>(
    'messaging/storage:generateUploadUrl',
  ),
  sendMedia: makeFunctionReference<
    'mutation',
    {
      threadId: string;
      clientMessageId: string;
      type: 'image' | 'video' | 'voice' | 'file' | 'sticker' | 'gif';
      mediaStorageId: string;
      mediaMime: string;
      mediaSizeBytes?: number;
      mediaDurationMs?: number;
      mediaWidth?: number;
      mediaHeight?: number;
      body?: string;
      replyToMessageId?: string;
    },
    string
  >('messaging/messenger:sendMedia'),
  suggestions: makeFunctionReference<'query', Record<string, never>, ChatPerson[]>(
    'messaging/discovery:suggestedPeopleToMessage',
  ),
  searchPeople: makeFunctionReference<'query', { q: string }, ChatPerson[]>(
    'messaging/discovery:searchUsersForChat',
  ),
  createDm: makeFunctionReference<'mutation', { otherUserId: string }, string>(
    'messaging/threads:createDm',
  ),
  createGroup: makeFunctionReference<
    'mutation',
    { title: string; memberUserIds: string[] },
    string
  >('messaging/threads:createGroup'),
  presence: makeFunctionReference<
    'query',
    { userIds: string[]; threadId?: string },
    { userId: string; status: string; lastSeenAt: number; settings?: MessengerPreferences }[]
  >('messaging/presence:getPresence'),
  savePreferences: makeFunctionReference<'mutation', Partial<MessengerPreferences>, null>(
    'messaging/presence:updateSettings',
  ),
  muteThread: makeFunctionReference<'mutation', { threadId: string; untilMs: number }, null>(
    'messaging/threads:setMuted',
  ),
  acceptTerms: makeFunctionReference<'mutation', { source: string }, unknown>(
    'core/id/cndp:acceptTerms',
  ),
  capabilities: makeFunctionReference<'query', Record<string, never>, MessengerCapabilities | null>(
    'messaging/messenger:capabilities',
  ),
  laneThreads: makeFunctionReference<'query', { lane: 'friends' | 'staff' }, ThreadSummary[]>(
    'messaging/messenger:listThreads',
  ),
  commerce: makeFunctionReference<'query', { lane: 'marketplace' }, CommerceSummary[]>(
    'messaging/messenger:listCommerce',
  ),
  commerceDetail: makeFunctionReference<
    'query',
    { conversationId: string; storeId?: string },
    { otherName: string; storeName: string; viewerSide: 'buyer' | 'seller' } | null
  >('marketplaceMessages:getConversation'),
  commerceMessages: makeFunctionReference<
    'query',
    { conversationId: string; storeId?: string; limit: number },
    CommerceMessage[]
  >('marketplaceMessages:listMessages'),
  commerceSend: makeFunctionReference<
    'mutation',
    {
      conversationId: string;
      storeId?: string;
      content: string;
      clientMessageId: string;
      parentMessageId?: string;
      imageStorageIds?: string[];
    },
    number
  >('marketplaceMessages:sendMessage'),
  commerceRead: makeFunctionReference<
    'mutation',
    { conversationId: string; storeId?: string; messageIds: string[] },
    null
  >('marketplaceMessages:markConversationAsRead'),
  commerceDelivered: makeFunctionReference<
    'mutation',
    { conversationId: string; storeId?: string; messageIds: string[] },
    null
  >('marketplaceMessages:markMessagesDelivered'),
  commerceReact: makeFunctionReference<
    'mutation',
    { storeId?: string; messageId: string; emoji: string },
    unknown
  >('marketplaceMessages:toggleReaction'),
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
  me: makeFunctionReference<
    'query',
    Record<string, never>,
    { _id: string; name?: string; image?: string } | null
  >('users:getMe'),
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
    { threadId: string; body: string; clientMessageId: string; replyToMessageId?: string },
    string
  >('messaging/messenger:sendText'),
  markDelivered: makeFunctionReference<'mutation', { threadId: string; messageId: string }, null>(
    'messaging/messenger:markDelivered',
  ),
  toggleReaction: makeFunctionReference<
    'mutation',
    { threadId: string; messageId: string; emoji: string },
    boolean
  >('messaging/messenger:toggleReaction'),
  markRead: makeFunctionReference<'mutation', { threadId: string; messageId: string }, null>(
    'messaging/messenger:markRead',
  ),
};
