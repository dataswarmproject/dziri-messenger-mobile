import React, { type ComponentProps } from 'react';
import { useQuery } from 'convex/react';
import { dziriApi } from './api';
import type { ReceiptScope } from './message-receipts.generated';
import { MessageBubble } from './message-bubble';
export function ReceiptMessageBubble({
  receiptScope,
  receiptVisible,
  ...props
}: ComponentProps<typeof MessageBubble> & {
  receiptScope?: ReceiptScope | null;
  receiptVisible?: boolean;
}) {
  const state = useQuery(
    dziriApi.receiptState,
    receiptScope && receiptVisible && props.mine && !props.message.local && !props.message.deleted
      ? {
          threadId: receiptScope.threadId,
          expectedActorId: receiptScope.actorId,
          messageId: props.message.id,
          ...(receiptScope.authorityKey ? { authorityKey: receiptScope.authorityKey } : {}),
        }
      : 'skip',
  );
  return (
    <MessageBubble
      {...props}
      message={
        props.mine && !props.message.local && !props.message.deleted
          ? { ...props.message, status: state ?? 'sent' }
          : props.message
      }
    />
  );
}
