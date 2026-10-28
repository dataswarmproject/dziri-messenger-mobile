import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { Text, TextInput } from './typography';
import { FigmaButton, FigmaIcon } from './figma';
import { useLocale } from './locale';
import { useColors } from './ui';
import { dziriApi } from './api';
import {
  normalizeExpressionSearch,
  searchDarija,
  expandExpressionSearch,
} from './expression-contract.generated';

const categories: Record<string, string> = {
  people: '🙂',
  nature: '🌿',
  foods: '☕',
  activity: '⚽',
  places: '✈️',
  objects: '💡',
  symbols: '❤️',
  flags: '🇩🇿',
};
const preferencesEnabled = process.env.EXPO_PUBLIC_EXPRESSIONS_V1_ENABLED === 'true';
type EmojiData = {
  categories: { id: string; emojis: string[] }[];
  emojis: Record<
    string,
    { id: string; name: string; keywords: string[]; skins: { native: string }[] }
  >;
};

/** Emoji-only picker: no provider requests, sticker catalogue or media actions. */
export function ExpressionPicker({
  close,
  selectEmoji,
  disabled,
}: {
  close: () => void;
  selectEmoji: (emoji: string) => void;
  disabled: boolean;
}) {
  const { t, rtl, locale } = useLocale(),
    colors = useColors();
  const [query, setQuery] = useState(''),
    [skin, setSkin] = useState(0),
    [category, setCategory] = useState('all');
  const [data, setData] = useState<EmojiData | null>(null),
    [failed, setFailed] = useState(false),
    [favoriteMode, setFavoriteMode] = useState(false);
  const preferences = useQuery(dziriApi.expressionPreferences, preferencesEnabled ? {} : 'skip');
  const policy = useQuery(dziriApi.expressionPolicy, preferencesEnabled ? {} : 'skip');
  const record = useMutation(dziriApi.recordExpression);
  useEffect(() => {
    let current = true;
    void import('@emoji-mart/data')
      .then(result => {
        if (current) setData(result.default as EmojiData);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, []);
  const results = useMemo(() => {
    if (!data) return [];
    const terms = expandExpressionSearch(query, policy?.aliases).map(normalizeExpressionSearch);
    const aliases = searchDarija(query).flatMap(entry => [...entry.emoji]);
    const allowed =
      category === 'all'
        ? null
        : new Set(data.categories.find(entry => entry.id === category)?.emojis ?? []);
    const saved =
      !query && category === 'all'
        ? [...(preferences?.favorites ?? []), ...(preferences?.recent ?? [])].flatMap(entry =>
            entry.kind === 'emoji' ? [entry.unicode] : [],
          )
        : [];
    return [
      ...new Set([
        ...saved,
        ...aliases,
        ...Object.values(data.emojis)
          .filter(
            entry =>
              (!allowed || allowed.has(entry.id)) &&
              (!query ||
                terms.some(term =>
                  normalizeExpressionSearch(
                    `${entry.name} ${entry.id} ${entry.keywords.join(' ')}`,
                  ).includes(term),
                )),
          )
          .map(entry => (entry.skins[skin] ?? entry.skins[0]).native),
      ]),
    ];
  }, [data, query, category, skin, policy, preferences]);
  const row = {
    flexDirection: rtl ? ('row-reverse' as const) : ('row' as const),
    alignItems: 'center' as const,
  };
  return (
    <View
      style={{
        height: 300,
        backgroundColor: colors.background,
        borderTopWidth: 0.5,
        borderColor: colors.border,
      }}>
      <View style={{ ...row, paddingHorizontal: 6, paddingVertical: 6, gap: 6 }}>
        <FigmaButton name="pickerClose" label={t.close} onPress={close} />
        <View
          style={{
            ...row,
            flex: 1,
            minWidth: 0,
            backgroundColor: colors.surface,
            borderRadius: 10,
            paddingHorizontal: 10,
          }}>
          <FigmaIcon name="pickerSearch" />
          <TextInput
            accessibilityLabel={t.searchStickers}
            placeholder={t.searchStickers}
            value={query}
            onChangeText={setQuery}
            placeholderTextColor={colors.secondary}
            style={{
              flex: 1,
              minWidth: 0,
              height: 36,
              paddingHorizontal: 8,
              fontSize: 13,
              color: colors.text,
            }}
          />
        </View>
        {preferencesEnabled && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              locale === 'ar' ? 'المفضلة' : locale === 'fr' ? 'Favoris' : 'Favorites'
            }
            accessibilityState={{ selected: favoriteMode }}
            onPress={() => setFavoriteMode(!favoriteMode)}
            style={{ minWidth: 40, minHeight: 40, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 22, color: colors.primary }}>{favoriteMode ? '★' : '☆'}</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        horizontal
        style={{ flexGrow: 0, flexShrink: 0, height: 36 }}
        contentContainerStyle={{ ...row, paddingHorizontal: 8 }}
        keyboardShouldPersistTaps="handled">
        {['👋', '👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿'].map((tone, index) => (
          <Pressable
            key={tone}
            accessibilityRole="button"
            accessibilityLabel={tone}
            accessibilityState={{ selected: skin === index }}
            onPress={() => setSkin(index)}
            style={{
              width: 36,
              minHeight: 36,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 10,
              backgroundColor: skin === index ? colors.surface : 'transparent',
            }}>
            <Text>{tone}</Text>
          </Pressable>
        ))}
        {[{ id: 'all' }, ...(data?.categories ?? [])].map(entry => (
          <Pressable
            key={entry.id}
            accessibilityRole="button"
            accessibilityLabel={entry.id}
            accessibilityState={{ selected: category === entry.id }}
            onPress={() => setCategory(entry.id)}
            style={{ width: 36, minHeight: 36, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: category === entry.id ? colors.primary : colors.secondary }}>
              {entry.id === 'all' ? '∞' : categories[entry.id]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {failed && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.secondary, padding: 8, fontSize: 12 }}>
          {t.failed}
        </Text>
      )}
      <FlatList
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1, minHeight: 0 }}
        data={results}
        numColumns={6}
        initialNumToRender={36}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        keyExtractor={value => value}
        ListEmptyComponent={
          <Text style={{ padding: 24, color: colors.secondary, textAlign: 'center', fontSize: 13 }}>
            {data ? t.noResults : t.loading}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item}
            disabled={disabled}
            onPress={() => {
              if (preferencesEnabled)
                void record({
                  expression: { kind: 'emoji', unicode: item },
                  ...(favoriteMode
                    ? {
                        favorite: !preferences?.favorites.some(
                          entry => entry.kind === 'emoji' && entry.unicode === item,
                        ),
                      }
                    : { used: true }),
                }).catch(() => setFailed(true));
              if (!favoriteMode) selectEmoji(item);
            }}
            style={{
              width: '16.6667%',
              minHeight: 46,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text style={{ fontSize: 25 }}>{item}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
