import React, { useEffect, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { FlatList, Pressable, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, TextInput } from './typography';
import { dziriApi, type ChatPerson } from './api';
import type { MessengerRoutes } from './routes';
import { useLocale } from './locale';
import { useColors } from './ui';
import { FigmaButton, FigmaIcon } from './figma';
import { DirectorySearch, PersonAvatar, ScreenHeading } from './screen-parts';
import { StoryComposer } from './story-composer';
import { DiscoverScreen } from './discover';
export function PeopleScreen({
  route,
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'People'>) {
  return route.params.mode === 'discover' ? (
    <DiscoverScreen navigation={navigation} initialBusinesses={route.params.businesses} />
  ) : (
    <ContactsScreen route={route} navigation={navigation} />
  );
}
function ContactsScreen({ route, navigation }: NativeStackScreenProps<MessengerRoutes, 'People'>) {
  const groupCommand = useRef<{ signature: string; id: string } | null>(null);
  const capabilities = useQuery(dziriApi.capabilities, {});
  const canGroup = capabilities?.features?.groupManagement === 1;
  const { t, rtl } = useLocale();
  const colors = useColors();
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [group, setGroup] = useState(false),
    [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const [story, setStory] = useState(false);
  const isPeople = route.params.mode === 'people' && !group;
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
  const presence = useQuery(
    dziriApi.presence,
    contacts.length ? { userIds: contacts.slice(0, 50).map(person => person.userId) } : 'skip',
  );
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
      const existing = threads?.find(
        thread => thread.type === 'dm' && thread.otherUser?._id === person.userId,
      );
      const threadId = existing?._id ?? (await createDm({ otherUserId: person.userId }));
      navigation.replace('Conversation', { threadId });
    } catch {
      setError(true);
      setBusy(false);
    }
  }
  async function startGroup() {
    if (!canGroup || busy || !title.trim() || !selected.length || selected.length > 50) return;
    setBusy(true);
    setError(false);
    try {
      const signature = JSON.stringify([title.trim(), ...[...selected].sort()]);
      if (groupCommand.current?.signature !== signature)
        groupCommand.current = { signature, id: randomUUID() };
      const threadId = await createGroup({
        title: title.trim(),
        memberUserIds: selected,
        clientRequestId: groupCommand.current.id,
      });
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
      {isPeople ? (
        <ScreenHeading title={t.people} back={() => navigation.goBack()}>
          <FigmaButton
            name="peopleRequests"
            label={t.chats}
            onPress={() => navigation.navigate('Chats')}
          />
          <FigmaButton
            name="peopleAdd"
            label={t.newMessage}
            onPress={() => navigation.push('People', { mode: 'new' })}
          />
        </ScreenHeading>
      ) : (
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
      )}
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
      {isPeople ? (
        <DirectorySearch value={search} change={setSearch} placeholder={t.searchPeople} />
      ) : (
        <View
          style={{
            height: 44,
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <Text style={{ fontSize: 14, color: colors.secondary }}>{t.to}:</Text>
          <TextInput
            accessibilityLabel={t.searchPeople}
            placeholder={t.searchPeople}
            placeholderTextColor={colors.secondary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              minWidth: 0,
              height: 44,
              fontSize: 14,
              paddingVertical: 8,
              color: colors.text,
            }}
          />
        </View>
      )}
      {isPeople ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.yourStory}
          onPress={() => setStory(true)}
          style={{
            height: 72,
            paddingHorizontal: 16,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 28, lineHeight: 34, color: colors.text }}>+</Text>
          </View>
          <View>
            <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>
              {t.yourStory}
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 18, color: colors.secondary }}>
              {t.addToStory}
            </Text>
          </View>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setGroup(value => !value)}
          disabled={!canGroup}
          style={{
            paddingHorizontal: 16,
            minHeight: 60,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <FigmaIcon name="group" />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 }}>
            {group ? t.cancel : t.newGroup}
          </Text>
          <FigmaIcon name="chevron" />
        </Pressable>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={{ padding: 16, color: colors.text }}>
          {t.failed}
        </Text>
      ) : null}
      <FlatList
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1, minHeight: 0 }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        data={data}
        keyExtractor={person => person.userId}
        ListEmptyComponent={
          <Text style={{ padding: 24, color: colors.secondary }}>
            {(
              query.length >= 2
                ? results === undefined
                : threads === undefined || suggestions === undefined
            )
              ? t.loading
              : t.noResults}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole={group ? 'checkbox' : 'button'}
            accessibilityLabel={item.name || item.handle || t.unknown}
            aria-checked={group ? selected.includes(item.userId) : undefined}
            accessibilityState={{
              selected: selected.includes(item.userId),
              checked: group ? selected.includes(item.userId) : undefined,
              disabled: busy,
            }}
            disabled={busy}
            onPress={() => void open(item)}
            style={{
              minHeight: 60,
              paddingHorizontal: 16,
              flexDirection: rtl ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 12,
            }}>
            <View>
              <PersonAvatar image={item.image} name={item.name || item.handle || '?'} />
              {presence?.some(row => row.userId === item.userId && row.status === 'online') ? (
                <View
                  accessibilityLabel={t.activeNow}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: rtl ? undefined : 0,
                    left: rtl ? 0 : undefined,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: colors.background,
                    backgroundColor: colors.primary,
                  }}
                />
              ) : null}
            </View>
            <View
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 60,
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
              ) : isPeople ? (
                <View
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <FigmaIcon name="peopleWave" />
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
      />
      {story ? <StoryComposer close={() => setStory(false)} /> : null}
    </View>
  );
}
