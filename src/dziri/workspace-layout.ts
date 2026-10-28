import design from '../../config/messenger-design.json' with { type: 'json' };
import type { MessengerTab } from '../messenger-policy';
const messengerMetrics = design.metrics;
export function messengerWorkspace(width: number, route: string, staffInbox = false) {
  return {
    split:
      Number.isFinite(width) &&
      width >= messengerMetrics.desktopBreakpoint &&
      !staffInbox &&
      ['Chats', 'Conversation', 'Commerce', 'Details'].includes(route),
    sidebarWidth:
      width >= messengerMetrics.desktopWideBreakpoint
        ? messengerMetrics.desktopSidebarWide
        : messengerMetrics.desktopSidebar,
  };
}
export function newConversationTarget(lane: MessengerTab) {
  return lane === 'staff' ? 'staffInbox' : lane === 'marketplace' ? 'businesses' : 'friends';
}
