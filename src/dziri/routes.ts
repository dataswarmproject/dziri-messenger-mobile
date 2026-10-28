export type MessengerRoutes = {
  Chats: undefined;
  Requests: undefined;
  Conversation: { threadId: string; lane?: 'friends' | 'staff'; focusMessageId?: string };
  Support: undefined;
  Commerce: { conversationId: string; storeId?: string; focusMessageId?: string };
  Settings: undefined;
  ProfileSettings: undefined;
  Privacy: undefined;
  BlockedPeople: undefined;
  StoreProfile: { slug: string };
  Profile: { userId: string };
  People: { mode: 'people' | 'new' | 'discover'; businesses?: boolean };
  Details: {
    threadId?: string;
    conversationId?: string;
    storeId?: string;
    lane?: 'friends' | 'staff';
  };
};
