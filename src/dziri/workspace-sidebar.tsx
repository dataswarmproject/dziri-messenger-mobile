import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { InboxScreen } from './inbox';
import type { MessengerRoutes } from './routes';
import type { MessengerCapabilities, MessengerTab } from '../messenger-policy';
import { MessengerTabs } from '../shell';
export type WorkspaceSelection = {
  name: string;
  threadId?: string;
  conversationId?: string;
  storeId?: string;
};
export function WorkspaceSidebar({
  lane,
  capabilities,
  select,
  openSupportInbox,
  selection,
}: {
  lane: MessengerTab;
  capabilities: MessengerCapabilities;
  select: (tab: MessengerTab) => void;
  openSupportInbox: () => void;
  selection?: WorkspaceSelection;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<MessengerRoutes, 'Chats'>>();
  return (
    <View style={{ flex: 1 }}>
      <InboxScreen
        navigation={navigation}
        route={{ key: 'workspace-chats', name: 'Chats', params: undefined }}
        lane={lane}
        openSupportInbox={openSupportInbox}
        selection={selection}
      />
      <MessengerTabs capabilities={capabilities} selected={lane} select={select} />
    </View>
  );
}
