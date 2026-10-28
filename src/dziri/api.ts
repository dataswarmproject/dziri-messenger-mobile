import { makeFunctionReference, type PaginationResult } from 'convex/server';
import type { PaginationOptions } from 'convex/server';
import type {
  StorySnapshot,
  StoryWriteContext,
  StoryReplyPreparation,
} from './messenger-stories.generated';
import type { MessengerCapabilities } from '../messenger-policy';
import type { MarketplaceWriteContext, PersonalWriteContext } from './message-writes.generated';
import type {
  ReceiptCommand,
  ReceiptSummary,
  MarketplaceReceiptContext,
  MarketplaceInboxSource,
  MarketplaceReactionInbox,
} from './message-receipts.generated';

export interface CommerceSummary {
  hasUnread?: boolean;
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
  moderationDecisionId?: string;
  editedAt?: number;
  partEvent?: unknown;
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
export interface PublicStore {
  _id: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
}
export interface PublicProfile {
  _id: string;
  name: string;
  handle?: string;
  image?: string;
  bio?: string;
  professionalHeadline?: string;
}
export interface StickerItem {
  _id: string;
  url: string;
  isAnimated: boolean;
  emojiHints: string[];
}
export interface StickerPack {
  _id: string;
  title: string;
  thumbnailUrl?: string;
  stickers: StickerItem[];
}
type SavedExpression = { kind: 'emoji'; unicode: string } | { kind: 'sticker'; stickerId: string };
export interface StickerCatalogPack {
  _id: string;
  title: string;
  thumbnailUrl?: string;
  isInLibrary: boolean;
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
  unreadCountComplete?: boolean;
  pinnedAt?: number;
  archivedAt?: number;
  markedUnreadAt?: number;
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
  writeContext?: PersonalWriteContext | null;
  request?: import('./messenger-safety.generated').RequestView;
  canSend?: boolean;
  peerUserId?: string;
  isSocialGroup?: boolean;
  memberCount?: number;
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
  pinnedAt?: number;
  forwardedFromMessageId?: string;
  forwardCount?: number;
  _id: string;
  threadId: string;
  senderId: string;
  senderName?: string;
  senderImage?: string;
  clientMessageId?: string;
  replyToMessageId?: string;
  replyPreview?: ReplyPreview;
  replyToStoryId?: string;
  replyToStorySnapshot?: StorySnapshot;
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
  editedAt?: number;
}

export const dziriApi = {
  receiptPrepare: makeFunctionReference<
    'mutation',
    { threadId: string; expectedActorId: string },
    ReceiptSummary
  >('messaging/unread:prepare'),
  receiptSummary: makeFunctionReference<
    'query',
    { threadId: string; expectedActorId: string },
    ReceiptSummary
  >('messaging/unread:summary'),
  acknowledgeReceipt: makeFunctionReference<'mutation', ReceiptCommand, null>(
    'messaging/receipts:acknowledge',
  ),
  receiptState: makeFunctionReference<
    'query',
    { threadId: string; expectedActorId: string; messageId: string },
    'sent' | 'delivered' | 'read' | null
  >('messaging/receipts:state'),
  registerPushToken: makeFunctionReference<
    'mutation',
    { platform: 'ios' | 'android'; token: string; deviceId: string },
    { created: boolean }
  >('pushTokens:registerToken'),
  typing: makeFunctionReference<
    'query',
    { threadId: string },
    { userId: string; name?: string; state: string; expiresAt?: number }[]
  >('messaging/typing:getTyping'),
  setTyping: makeFunctionReference<'mutation', { threadId: string; state: 'typing' }, null>(
    'messaging/typing:setTyping',
  ),
  clearTyping: makeFunctionReference<'mutation', { threadId: string }, null>(
    'messaging/typing:clearTyping',
  ),
  blockState: makeFunctionReference<'query', { otherUserId: string }, { blocked: boolean }>(
    'messaging/safety:state',
  ),
  blockedPage: makeFunctionReference<
    'query',
    { paginationOpts: PaginationOptions },
    PaginationResult<{ userId: string; name?: string; image?: string }>
  >('messaging/safety:blockedPage'),
  blockUser: makeFunctionReference<'mutation', { blockedUserId: string }, string>(
    'messaging/moderationDecisions:blockUser',
  ),
  unblockUser: makeFunctionReference<'mutation', { blockedUserId: string }, null>(
    'messaging/moderationDecisions:unblockUser',
  ),
  groupMembers: makeFunctionReference<
    'query',
    { threadId: string; paginationOpts: PaginationOptions },
    PaginationResult<{
      userId: string;
      role: string;
      name?: string;
      image?: string;
      available: boolean;
    }>
  >('messaging/groups:members'),
  groupAdd: makeFunctionReference<'mutation', { threadId: string; userIdToAdd: string }, null>(
    'messaging/groups:add',
  ),
  groupRename: makeFunctionReference<'mutation', { threadId: string; title: string }, null>(
    'messaging/groups:rename',
  ),
  groupUpdateMember: makeFunctionReference<
    'mutation',
    { threadId: string; userId: string; action: 'remove' | 'promote' | 'demote' | 'transfer' },
    null
  >('messaging/groups:updateMember'),
  groupLeave: makeFunctionReference<'mutation', { threadId: string }, null>(
    'messaging/groups:leave',
  ),
  pinnedMessages: makeFunctionReference<
    'query',
    { threadId: string },
    { id: string; body?: string; type: string; createdAt: number; pinnedAt?: number }[]
  >('messaging/organization:pinnedMessages'),
  forwardText: makeFunctionReference<
    'mutation',
    { messageId: string; targetThreadId: string; expectedBody: string; clientMessageId: string },
    string
  >('messaging/forwarding:forwardText'),
  pinMessage: makeFunctionReference<'mutation', { messageId: string; pinned?: boolean }, boolean>(
    'messaging/messages:togglePin',
  ),
  organizeThread: makeFunctionReference<
    'mutation',
    { threadId: string; action: 'archive' | 'pin' | 'unread'; value: boolean },
    null
  >('messaging/organization:updateThread'),
  editMessage: makeFunctionReference<'mutation', { messageId: string; newBody: string }, null>(
    'messaging/messages:editMessage',
  ),
  deleteMessage: makeFunctionReference<'mutation', { messageId: string; scope: 'everyone' }, null>(
    'messaging/messages:deleteMessage',
  ),
  commerceEdit: makeFunctionReference<
    'mutation',
    { messageId: string; storeId?: string; content: string },
    unknown
  >('marketplaceMessages:editMessage'),
  commerceDelete: makeFunctionReference<
    'mutation',
    { messageId: string; storeId?: string },
    unknown
  >('marketplaceMessages:deleteMessage'),
  publicProfile: makeFunctionReference<'query', { userId: string }, PublicProfile | null>(
    'users:getPublicProfile',
  ),
  startStoreConversation: makeFunctionReference<'mutation', { storeId: string }, string>(
    'marketplaceMessages:getOrCreateConversation',
  ),
  publicStores: makeFunctionReference<'query', { limit: number }, PublicStore[]>(
    'marketplace:listStores',
  ),
  publicStore: makeFunctionReference<
    'query',
    { slug: string },
    (PublicStore & { logoUrl?: string | null }) | null
  >('marketplace:getStoreBySlug'),
  heartbeat: makeFunctionReference<'mutation', { deviceLabel?: string }, null>(
    'messaging/presence:heartbeat',
  ),
  stickerLibrary: makeFunctionReference<'query', Record<string, never>, StickerPack[]>(
    'messaging/messenger:stickerLibrary',
  ),
  expressionPreferences: makeFunctionReference<
    'query',
    Record<string, never>,
    { recent: SavedExpression[]; favorites: SavedExpression[] }
  >('expressions/preferences:list'),
  recordExpression: makeFunctionReference<
    'mutation',
    { expression: SavedExpression; used?: boolean; favorite?: boolean },
    null
  >('expressions/preferences:record'),
  expressionPolicy: makeFunctionReference<
    'query',
    Record<string, never>,
    { aliases: { alias: string; target: string }[] }
  >('expressions/config:policy'),
  stickerCatalog: makeFunctionReference<'query', { free: true }, StickerCatalogPack[]>(
    'messaging/stickerPacks:browse',
  ),
  addStickerPack: makeFunctionReference<'mutation', { packId: string }, null>(
    'messaging/stickerPacks:addFreePack',
  ),
  sendSticker: makeFunctionReference<
    'mutation',
    { threadId: string; stickerId: string; clientMessageId: string; replyToMessageId?: string },
    string
  >('messaging/messenger:sendSticker'),
  stories: makeFunctionReference<'query', Record<string, never>, StoryRecord[]>(
    'messaging/stories:listFollowing',
  ),
  storyPrepare: makeFunctionReference<
    'query',
    {
      storyId: string;
      expectedActorId: string;
      pendingCommand?: { clientMessageId: string; payloadHash: string };
    },
    StoryReplyPreparation | null
  >('messaging/storyReply:prepareReply'),
  storyReply: makeFunctionReference<
    'mutation',
    { storyId: string; body: string; clientMessageId: string; commandContext: StoryWriteContext },
    string
  >('messaging/storyReply:replyToStory'),
  storyReaction: makeFunctionReference<
    'mutation',
    { storyId: string; emoji: string; clientMessageId: string; commandContext: StoryWriteContext },
    string
  >('messaging/storyReply:reactToStory'),
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
      audience: 'followers' | 'public';
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
      commandContext?: PersonalWriteContext;
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
  createDm: makeFunctionReference<
    'mutation',
    { otherUserId: string; expectedActorId?: string },
    string
  >('messaging/threads:createDm'),
  createGroup: makeFunctionReference<
    'mutation',
    { title: string; memberUserIds: string[]; clientRequestId: string },
    string
  >('messaging/groups:create'),
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
  laneThreads: makeFunctionReference<
    'query',
    { lane: 'friends' | 'staff'; archived?: boolean },
    ThreadSummary[]
  >('messaging/messenger:listThreads'),
  commerce: makeFunctionReference<'query', { lane: 'marketplace' }, CommerceSummary[]>(
    'messaging/messenger:listCommerce',
  ),
  commerceDetail: makeFunctionReference<
    'query',
    { conversationId: string; storeId?: string },
    {
      otherName: string;
      otherImage?: string | null;
      storeName: string;
      viewerSide: 'buyer' | 'seller';
      receiptContext?: MarketplaceReceiptContext | null;
      writeContext?: MarketplaceWriteContext | null;
    } | null
  >('marketplaceMessages:getConversation'),
  commerceMessages: makeFunctionReference<
    'query',
    { conversationId: string; storeId?: string; limit: number },
    CommerceMessage[]
  >('marketplaceMessages:listMessages'),
  commercePage: makeFunctionReference<
    'query',
    { conversationId: string; storeId?: string; paginationOpts: PaginationOptions },
    PaginationResult<CommerceMessage>
  >('marketplaceMessages:listMessagePage'),
  commerceSend: makeFunctionReference<
    'mutation',
    {
      conversationId: string;
      storeId?: string;
      content: string;
      clientMessageId: string;
      parentMessageId?: string;
      imageStorageIds?: string[];
      commandContext?: MarketplaceWriteContext;
    },
    number
  >('marketplaceMessages:sendMessage'),
  commerceRead: makeFunctionReference<
    'mutation',
    {
      conversationId: string;
      storeId?: string;
      messageIds: string[];
      observation?: MarketplaceReceiptContext;
    },
    null
  >('marketplaceMessages:markConversationAsRead'),
  reactionInbox: makeFunctionReference<
    'query',
    MarketplaceInboxSource,
    MarketplaceReactionInbox | null
  >('marketplaceMessages:reactionInbox'),
  acknowledgeReactionInbox: makeFunctionReference<
    'mutation',
    MarketplaceInboxSource,
    { more: boolean }
  >('marketplaceMessages:acknowledgeReactionInbox'),
  commerceDelivered: makeFunctionReference<
    'mutation',
    {
      conversationId: string;
      storeId?: string;
      messageIds: string[];
      observation?: MarketplaceReceiptContext;
    },
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
    { _id: string; name?: string; image?: string; handle?: string; phone?: string } | null
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
    {
      threadId: string;
      body: string;
      clientMessageId: string;
      replyToMessageId?: string;
      commandContext?: PersonalWriteContext;
    },
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
