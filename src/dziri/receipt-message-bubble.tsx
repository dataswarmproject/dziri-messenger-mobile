import React, { type ComponentProps } from 'react';
import { useQuery } from 'convex/react';
import { dziriApi } from './api';
import type { ReceiptScope, MarketplaceInboxSource } from './message-receipts.generated';
import { MessageBubble } from './message-bubble';
export function ReceiptMessageBubble({
  receiptScope,
  receiptVisible,
  marketplace,
  ...props
}: ComponentProps<typeof MessageBubble> & {
  receiptScope?: ReceiptScope | null;
  receiptVisible?: boolean;
  marketplace?: MarketplaceInboxSource | null;
}) {
  const marketplaceMode = marketplace !== undefined;
  const storedOutgoing = props.mine && !props.message.local && !props.message.deleted;
  const marketplaceEnabled =
    marketplaceMode &&
    !!marketplace &&
    receiptVisible &&
    storedOutgoing &&
    props.message.reportable !== false;
  const marketplaceState = useQuery(
    dziriApi.commerceReceiptState,
    marketplaceEnabled ? { ...marketplace, messageId: props.message.id } : 'skip',
  );
  const state = useQuery(
    dziriApi.receiptState,
    !marketplaceMode && receiptScope && receiptVisible && storedOutgoing
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
        marketplaceMode && !props.message.local
          ? {
              ...props.message,
              status: marketplaceEnabled ? (marketplaceState ?? undefined) : undefined,
            }
          : storedOutgoing
            ? { ...props.message, status: state ?? 'sent' }
            : props.message
      }
    />
  );
}
