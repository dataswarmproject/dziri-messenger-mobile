import React, { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './dziri/typography';
import { Image } from 'expo-image';
import { useLocale } from './dziri/locale';
import { LanguageMenu, useColors } from './dziri/ui';
import { messengerTabs, type MessengerCapabilities, type MessengerTab } from './messenger-policy';

export function MessengerShell({
  capabilities,
  selected = 'friends',
  select,
  children,
  account,
}: {
  capabilities?: MessengerCapabilities | null;
  selected?: MessengerTab;
  select?: (tab: MessengerTab) => void;
  children: ReactNode;
  account?: ReactNode;
}) {
  const { t, rtl } = useLocale();
  const colors = useColors();
  const labels = { friends: t.friendsTab, marketplace: t.marketplaceTab, staff: t.teamView };
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction: 'ltr' }}>
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
            source={require('../assets/dziri-ring.svg')}
            contentFit="contain"
            tintColor={colors.text}
            style={{ width: 32, height: 32 }}
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
      {capabilities && select ? (
        <View style={{ borderBottomWidth: 1, borderColor: colors.border }}>
          <ScrollView
            horizontal
            accessibilityRole="tablist"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              flexDirection: rtl ? 'row-reverse' : 'row',
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
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  minHeight: 48,
                  opacity: pressed ? 0.65 : 1,
                  borderBottomWidth: 2,
                  borderBottomColor: tab === selected ? colors.primary : 'transparent',
                })}>
                <Text
                  style={{
                    color: tab === selected ? colors.primary : colors.secondary,
                    fontWeight: tab === selected ? '600' : '400',
                  }}>
                  {labels[tab]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
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
