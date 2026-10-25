export type MessengerTab = 'friends' | 'marketplace' | 'staff';
export interface MessengerCapabilities {
  staff: boolean;
  marketplace: boolean;
  businesses: { id: string; name: string; role: string }[];
  stores: { id: string; name: string }[];
}

export function messengerTabs(state?: MessengerCapabilities | null): MessengerTab[] {
  const tabs: MessengerTab[] = ['friends'];
  if (state?.marketplace) tabs.push('marketplace');
  if (state?.staff && state.businesses.length) tabs.push('staff');
  return tabs;
}

export function activeMessengerTab(selected: MessengerTab, state?: MessengerCapabilities | null) {
  return messengerTabs(state).includes(selected) ? selected : 'friends';
}

export function messengerScopeKey(userId: string, tab: MessengerTab, state: MessengerCapabilities) {
  const scope =
    tab === 'staff'
      ? state.businesses.map(b => `${b.id}:${b.role}`)
      : tab === 'marketplace'
        ? state.stores.map(s => s.id)
        : [];
  return JSON.stringify([userId, tab, scope.sort()]);
}
