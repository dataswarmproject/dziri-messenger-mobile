import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, TextInput } from './typography';
import { dziriApi, type ChatPerson } from './api';
import type { MessengerRoutes } from './routes';
import { useLocale } from './locale';
import { useColors } from './ui';
import { FigmaButton, FigmaIcon } from './figma';
export function PeopleScreen({
  route,
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'People'>) {
  const { t, rtl } = useLocale();
  const colors = useColors();
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [group, setGroup] = useState(false),
    [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const suggestions = useQuery(dziriApi.suggestions, {});
  const threads = useQuery(dziriApi.laneThreads, { lane: 'friends' });
  const results = useQuery(dziriApi.searchPeople, query.length >= 2 ? { q: query } : 'skip');
  const createDm = useMutation(dziriApi.createDm),
    createGroup = useMutation(dziriApi.createGroup);
  const contacts = useMemo(() => {
    const all = new Map<string, ChatPerson>();
    for (const row of threads ?? [])
      if (row.otherUser)
        all.set(row.otherUser._id, {
          userId: row.otherUser._id,
          name: row.otherUser.name,
          handle: row.otherUser.handle,
          image: row.otherUser.image,
          isOnline: false,
        });
    for (const person of suggestions ?? [])
      if (!all.has(person.userId)) all.set(person.userId, person);
    return [...all.values()];
  }, [threads, suggestions]);
  async function open(person: ChatPerson) {
    if (group) {
      setSelected(ids =>
        ids.includes(person.userId)
          ? ids.filter(id => id !== person.userId)
          : [...ids, person.userId].slice(0, 64),
      );
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const threadId = await createDm({ otherUserId: person.userId });
      navigation.replace('Conversation', { threadId });
    } catch {
      setError(true);
      setBusy(false);
    }
  }
  async function startGroup() {
    if (busy || !title.trim() || !selected.length) return;
    setBusy(true);
    setError(false);
    try {
      const threadId = await createGroup({ title: title.trim(), memberUserIds: selected });
      navigation.replace('Conversation', { threadId });
    } catch {
      setError(true);
      setBusy(false);
    }
  }
  const data =
    query.length >= 2
      ? (results ?? [])
      : contacts.filter(
          person =>
            !query ||
            `${person.name} ${person.handle}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase()),
        );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          height: 56,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
        }}>
        <FigmaButton name="back" label={t.cancel} onPress={() => navigation.goBack()} />
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: '700',
            textAlign: 'center',
            color: colors.text,
          }}>
          {group ? t.newGroup : route.params.mode === 'new' ? t.newMessage : t[route.params.mode]}
        </Text>
        {group ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || !title.trim() || !selected.length}
            onPress={() => void startGroup()}
            style={{ padding: 12 }}>
            <Text style={{ color: colors.primary }}>{t.create}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>
      {group ? (
        <TextInput
          accessibilityLabel={t.groupName}
          placeholder={t.groupName}
          placeholderTextColor={colors.secondary}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          style={{ padding: 16, fontSize: 15, color: colors.text, backgroundColor: colors.surface }}
        />
      ) : null}
      <View
        style={{
          marginHorizontal: 16,
          marginVertical: 8,
          paddingHorizontal: 10,
          minHeight: 36,
          borderRadius: 10,
          backgroundColor: colors.surface,
          flexDirection: rtl ? 'row-reverse' : 'row',
          gap: 8,
          alignItems: 'center',
        }}>
        <FigmaIcon name="search" />
        <TextInput
          accessibilityLabel={t.searchConversations}
          placeholder={t.to}
          placeholderTextColor={colors.secondary}
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 8, color: colors.text }}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setGroup(value => !value)}
        style={{
          padding: 16,
          minHeight: 60,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 16,
        }}>
        <FigmaIcon name="peopleActive" />
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
          {group ? t.cancel : t.newGroup}
        </Text>
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={{ padding: 16, color: colors.text }}>
          {t.failed}
        </Text>
      ) : null}
      <FlatList
        data={data}
        keyExtractor={person => person.userId}
        ListEmptyComponent={
          <Text style={{ padding: 24, color: colors.secondary }}>
            {results === undefined && query.length >= 2 ? t.loading : t.noResults}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.name || item.handle || t.unknown}
            accessibilityState={{ selected: selected.includes(item.userId), disabled: busy }}
            disabled={busy}
            onPress={() => void open(item)}
            style={{
              minHeight: 60,
              paddingHorizontal: 16,
              flexDirection: rtl ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 12,
            }}>
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ color: colors.secondary }}>
                  {(item.name || item.handle || '?')[0]}
                </Text>
              </View>
            )}
            <View
              style={{
                flex: 1,
                minWidth: 0,
                paddingVertical: 18,
                borderBottomWidth: 0.5,
                borderColor: colors.border,
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
              }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 }}>
                {item.name || item.handle || t.unknown}
              </Text>
              {selected.includes(item.userId) ? (
                <Text style={{ color: colors.primary }}>✓</Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
