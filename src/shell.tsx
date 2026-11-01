import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './dziri/typography';
import { Image } from 'expo-image';
import { useLocale } from './dziri/locale';
import { LanguageMenu, useColors } from './dziri/ui';
import { messengerTabs, type MessengerCapabilities, type MessengerTab } from './messenger-policy';
import { FigmaIcon, type FigmaIconName } from './dziri/figma';
import { Icon } from './dziri/icons';

export function MessengerShell({
  capabilities,
  selected = 'friends',
  select,
  children,
  account,
  immersive = false,
  profile,
}: {
  capabilities?: MessengerCapabilities | null;
  selected?: MessengerTab;
  select?: (tab: MessengerTab) => void;
  children: ReactNode;
  account?: ReactNode;
  immersive?: boolean;
  profile?: { image?: string; open: () => void };
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
              source={require('../assets/dziri-ring-transparent.png')}
              tintColor={colors.text}
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
        <MessengerTabs
          capabilities={capabilities}
          selected={selected}
          select={select}
          profile={profile}
        />
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
  profile,
}: {
  capabilities: MessengerCapabilities;
  selected: MessengerTab;
  select: (tab: MessengerTab) => void;
  profile?: { image?: string; open: () => void };
}) {
  const { t, rtl } = useLocale();
  const colors = useColors();
  const labels = { friends: t.friendsTab, marketplace: t.marketplaceTab, staff: t.teamView };
  const tabs = messengerTabs(capabilities);
  return (
    <View
      style={{
        borderTopWidth: 0.5,
        borderColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        paddingHorizontal: 12,
      }}>
      <View
        accessibilityRole="tablist"
        style={{ flex: tabs.length, flexDirection: rtl ? 'row-reverse' : 'row' }}>
        {tabs.map(tab => (
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
            {tab === 'staff' || tab === 'marketplace' ? (
              <Icon
                name={tab}
                size={24}
                active={tab === selected}
                color={tab === selected ? colors.primary : colors.secondary}
              />
            ) : (
              <FigmaIcon
                name={
                  {
                    friends: tab === selected ? 'chats' : 'chatsInactive',
                    marketplace: tab === selected ? 'discoverActive' : 'discover',
                    staff: tab === selected ? 'peopleActive' : 'people',
                  }[tab] as FigmaIconName
                }
              />
            )}
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
      {profile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.profile}
          onPress={profile.open}
          style={{
            flex: 1,
            minHeight: 60,
            paddingVertical: 10,
            paddingHorizontal: 4,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}>
          <Image
            source={
              profile.image
                ? { uri: profile.image }
                : require('../assets/dziri-ring-transparent.png')
            }
            contentFit={profile.image ? 'cover' : 'contain'}
            tintColor={profile.image ? undefined : colors.text}
            accessible={false}
            style={{ width: 28, height: 28, borderRadius: 14 }}
          />
          <Text
            numberOfLines={1}
            style={{ fontSize: 10, color: colors.secondary, textAlign: 'center' }}>
            {t.profile}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
