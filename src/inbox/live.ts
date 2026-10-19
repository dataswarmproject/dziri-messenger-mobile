import { createConsumer } from '@rails/actioncable';
import type { Profile } from './client';

const updates = new Set([
  'message.created',
  'message.updated',
  'message.deleted',
  'conversation.created',
  'conversation.updated',
  'conversation.status_changed',
  'conversation.read',
  'conversation.deleted',
  'assignee.changed',
  'contact.updated',
]);

export function subscribeInbox(
  origin: string,
  profile: Profile,
  account: number,
  changed: () => void,
  connection: (online: boolean) => void,
) {
  const consumer = createConsumer(`${origin.replace(/^http/, 'ws')}/cable`);
  const subscription = consumer.subscriptions.create(
    {
      channel: 'RoomChannel',
      pubsub_token: profile.pubsub_token,
      account_id: account,
      user_id: profile.id,
    },
    {
      connected() {
        connection(true);
        changed();
      },
      disconnected() {
        connection(false);
      },
      rejected() {
        connection(false);
      },
      received(event: { event?: string; data?: { account_id?: number } }) {
        if (event.data?.account_id === account && updates.has(event.event ?? '')) changed();
      },
    },
  );
  const presence = setInterval(() => subscription.perform('update_presence'), 20000);
  return () => {
    clearInterval(presence);
    subscription.unsubscribe();
    consumer.disconnect();
  };
}
