export interface TextSend {
  threadId: string;
  body: string;
  clientMessageId: string;
}

/** In-memory retry boundary for this slice; persistence is a separate outbox task. */
export function createTextSender<T>(mutate: (args: TextSend) => Promise<T>, makeId: () => string) {
  let pending: TextSend | undefined;
  let sending = false;

  return {
    async send(threadId: string, text: string): Promise<T> {
      if (sending) throw new Error('Send in progress');
      const body = text.trim();
      // Existing messaging/messages:sendText enforces 8000 JS string characters.
      if (!body || body.length > 8000) throw new Error('Invalid message length');
      if (!pending || pending.threadId !== threadId || pending.body !== body) {
        pending = { threadId, body, clientMessageId: makeId() };
      }
      sending = true;
      try {
        const messageId = await mutate(pending);
        pending = undefined;
        return messageId;
      } finally {
        sending = false;
      }
    },
  };
}
