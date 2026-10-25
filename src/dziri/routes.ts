export type MessengerRoutes = {
  Chats: undefined;
  Conversation: { threadId: string };
  Support: undefined;
  Commerce: { conversationId: string; storeId?: string };
  Settings: undefined;
  People: { mode: 'people' | 'new' | 'discover' };
  Details: { threadId?: string; conversationId?: string; storeId?: string };
};
