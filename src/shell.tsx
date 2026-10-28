import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './dziri/typography';
import { Image } from 'expo-image';
import { useLocale } from './dziri/locale';
import { LanguageMenu, useColors } from './dziri/ui';
import { messengerTabs, type MessengerCapabilities, type MessengerTab } from './messenger-policy';
import { FigmaIcon, type FigmaIconName } from './dziri/figma';

export function MessengerShell({
  capabilities,
  selected = 'friends',
  select,
  children,
  account,
  immersive = false,
}: {
  capabilities?: MessengerCapabilities | null;
  selected?: MessengerTab;
  select?: (tab: MessengerTab) => void;
  children: ReactNode;
  account?: ReactNode;
  immersive?: boolean;
}) {
  const { t, rtl } = useLocale();
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction: 'ltr' }}>
      {!capabilities || !select ? (
        <View
          style={[
            styles.header,
            { borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' },
          ]}>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: rtl ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 10,
            }}>
            <Image
              source={require('../assets/dziri-ring.png')}
              contentFit="contain"
              style={{ width: 32, height: 32, borderRadius: 6 }}
            />
            <Text
              numberOfLines={1}
              style={{ flexShrink: 1, color: colors.text, fontSize: 17, fontWeight: '600' }}>
              {t.app}
            </Text>
          </View>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
            <LanguageMenu />
            {account}
          </View>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
      {capabilities && select && !immersive ? (
        <MessengerTabs capabilities={capabilities} selected={selected} select={select} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    gap: 8,
  },
});

export function MessengerTabs({
  capabilities,
  selected,
  select,
}: {
  capabilities: MessengerCapabilities;
  selected: MessengerTab;
  select: (tab: MessengerTab) => void;
}) {
  const { t, rtl } = useLocale();
  const colors = useColors();
  const labels = { friends: t.friendsTab, marketplace: t.marketplaceTab, staff: t.teamView };
  return (
    <View
      accessibilityRole="tablist"
      style={{
        borderTopWidth: 0.5,
        borderColor: colors.border,
        flexDirection: rtl ? 'row-reverse' : 'row',
        justifyContent: 'space-evenly',
        paddingHorizontal: 12,
      }}>
      {messengerTabs(capabilities).map(tab => (
        <Pressable
          key={tab}
          accessibilityRole="tab"
          aria-selected={tab === selected}
          accessibilityState={{ selected: tab === selected }}
          onPress={() => select?.(tab)}
          style={({ pressed }) => ({
            flex: 1,
            paddingHorizontal: 4,
            paddingVertical: 10,
            minHeight: 60,
            alignItems: 'center',
            gap: 4,
            opacity: pressed ? 0.65 : 1,
          })}>
          <FigmaIcon
            name={
              {
                friends: tab === selected ? 'chats' : 'chatsInactive',
                marketplace: tab === selected ? 'discoverActive' : 'discover',
                staff: tab === selected ? 'peopleActive' : 'people',
              }[tab] as FigmaIconName
            }
          />
          <Text
            style={{
              color: tab === selected ? colors.primary : colors.secondary,
              fontWeight: tab === selected ? '600' : '400',
              fontSize: 10,
              textAlign: 'center',
            }}>
            {labels[tab]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
