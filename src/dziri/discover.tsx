import React, { useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { useQuery } from 'convex/react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { dziriApi, type PublicStore } from './api';
import type { MessengerRoutes } from './routes';
import { Text } from './typography';
import { useLocale } from './locale';
import { useColors } from './ui';
import { DirectorySearch, DirectoryTab, PersonAvatar, ScreenHeading } from './screen-parts';

function StoreRow({ store, open }: { store: PublicStore; open: (slug: string) => void }) {
  // Resolve only mounted, logo-bearing rows through the existing public storefront reader.
  const details = useQuery(dziriApi.publicStore, store.logo ? { slug: store.slug } : 'skip');
  const colors = useColors();
  const { rtl, t } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${store.name}, ${t.openStore}`}
      onPress={() => open(store.slug)}
      style={({ pressed }) => ({
        minHeight: 76,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 12,
        alignItems: 'center',
        flexDirection: rtl ? 'row-reverse' : 'row',
        backgroundColor: pressed ? colors.surface : colors.background,
      })}>
      <PersonAvatar image={details?.logoUrl} name={store.name} size={60} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>
          {store.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: colors.secondary }}>
          {t.businesses}
        </Text>
        {store.description ? (
          <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: colors.secondary }}>
            {store.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function DiscoverScreen({
  navigation,
  initialBusinesses = false,
}: {
  navigation: NativeStackNavigationProp<MessengerRoutes, 'People'>;
  initialBusinesses?: boolean;
}) {
  const colors = useColors();
  const { t, rtl } = useLocale();
  const [businesses, setBusinesses] = useState(initialBusinesses),
    [search, setSearch] = useState('');
  const stores = useQuery(dziriApi.publicStores, { limit: 50 });
  const recent = useQuery(dziriApi.commerce, businesses ? 'skip' : { lane: 'marketplace' });
  const query = search.trim().toLocaleLowerCase();
  const data = (stores ?? []).filter(
    store =>
      !query || `${store.name} ${store.description ?? ''}`.toLocaleLowerCase().includes(query),
  );
  const openStore = (slug: string) => navigation.navigate('StoreProfile', { slug });
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeading title={t.discover} back={() => navigation.goBack()} />
      <View
        accessibilityRole="tablist"
        style={{ flexDirection: rtl ? 'row-reverse' : 'row', paddingHorizontal: 16, gap: 4 }}>
        <DirectoryTab
          label={t.forYou.toLocaleUpperCase()}
          selected={!businesses}
          press={() => setBusinesses(false)}
        />
        <DirectoryTab
          label={t.businesses.toLocaleUpperCase()}
          selected={businesses}
          press={() => setBusinesses(true)}
        />
      </View>
      <DirectorySearch value={search} change={setSearch} placeholder={t.searchStores} />
      <FlatList
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1, minHeight: 0 }}
        data={data}
        keyExtractor={store => store._id}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {!businesses && !query && !!recent?.length ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    fontSize: 18,
                    lineHeight: 24,
                    fontWeight: '700',
                    color: colors.text,
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: 8,
                  }}>
                  {t.recentConversations}
                </Text>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ height: 98 }}
                  contentContainerStyle={{
                    paddingHorizontal: 12,
                    gap: 12,
                    flexDirection: rtl ? 'row-reverse' : 'row',
                  }}>
                  {recent.slice(0, 8).map(row => (
                    <Pressable
                      key={row._id}
                      accessibilityRole="button"
                      accessibilityLabel={row.title}
                      onPress={() =>
                        navigation.navigate('Commerce', {
                          conversationId: row._id,
                          storeId: row.storeId,
                        })
                      }
                      style={{ width: 76, alignItems: 'center', gap: 7 }}>
                      <PersonAvatar image={row.avatarUrl} name={row.title} size={60} />
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 13, lineHeight: 18, color: colors.secondary }}>
                        {row.title}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 18,
                lineHeight: 24,
                fontWeight: '700',
                color: colors.text,
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 6,
              }}>
              {t.businesses}
            </Text>
          </>
        }
        ListEmptyComponent={
          <Text style={{ padding: 24, fontSize: 14, color: colors.secondary }}>
            {stores === undefined ? t.loading : t.noResults}
          </Text>
        }
        renderItem={({ item }) => <StoreRow store={item} open={openStore} />}
      />
    </View>
  );
}
