export type MessengerRoutes = {
  Chats: undefined;
  Conversation: { threadId: string };
  Support: undefined;
  Commerce: { conversationId: string; storeId?: string };
};
