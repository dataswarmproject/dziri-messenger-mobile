import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { randomUUID } from 'expo-crypto';
import { dziriApi } from './api';
import { Text, TextInput } from './typography';
import { IconButton } from './icons';
import { useColors } from './ui';
import { useLocale } from './locale';
import type { BubbleMessage } from './message-bubble';

export function ForwardMessage({
  message,
  threadId,
  complete,
  back,
}: {
  message: BubbleMessage;
  threadId: string;
  complete: () => void;
  back: () => void;
}) {
  const threads = useQuery(dziriApi.laneThreads, { lane: 'friends' });
  const send = useMutation(dziriApi.forwardText);
  const { t, rtl, locale } = useLocale(),
    colors = useColors();
  const [search, setSearch] = useState(''),
    [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const command = useRef<{ target: string; id: string } | null>(null),
    lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const allowed = threads?.filter(
    row =>
      row._id !== threadId &&
      ['dm', 'group'].includes(row.type) &&
      !row.isFrozen &&
      row.encryption !== 'e2ee',
  );
  const selected = allowed?.find(row => row._id === target);
  const title = (row: NonNullable<typeof allowed>[number]) =>
    row.title || row.otherUser?.name || row.otherUser?.handle || t.unknown;
  useEffect(() => {
    if (target && allowed && !selected) setTarget(null);
  }, [target, allowed, selected]);
  async function forward() {
    if (!selected || lock.current || !message.actionBody) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    if (command.current?.target !== selected._id)
      command.current = { target: selected._id, id: randomUUID() };
    try {
      await send({
        messageId: message.id,
        targetThreadId: selected._id,
        expectedBody: message.actionBody,
        clientMessageId: command.current.id,
      });
      if (mounted.current) complete();
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <View
      style={{
        width: '100%',
        maxWidth: 420,
        maxHeight: '85%',
        padding: 20,
        borderRadius: 24,
        backgroundColor: colors.actionSurface,
      }}>
      <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: 20, color: colors.text }}>
          {t.forwardMessage}
        </Text>
        <IconButton
          name="close"
          label={t.close}
          color={colors.text}
          disabled={busy}
          onPress={back}
        />
      </View>
      <Text style={{ color: colors.secondary, fontSize: 13, paddingVertical: 12 }}>
        {selected ? `${t.forwardTo} ${title(selected)}` : t.recentConversations}
      </Text>
      {selected ? (
        <>
          <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                lineHeight: 21,
                padding: 12,
                backgroundColor: colors.surface,
                borderRadius: 12,
              }}>
              {message.actionBody}
            </Text>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              setTarget(null);
              command.current = null;
            }}
            style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.secondary }}>{t.chooseConversation}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            accessibilityLabel={t.searchConversations}
            value={search}
            onChangeText={setSearch}
            placeholder={t.searchConversations}
            placeholderTextColor={colors.secondary}
            style={{
              minHeight: 44,
              borderRadius: 12,
              backgroundColor: colors.surface,
              padding: 12,
              color: colors.text,
            }}
          />
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {allowed === undefined ? (
              <ActivityIndicator color={colors.secondary} />
            ) : (
              allowed
                .filter(row =>
                  title(row)
                    .toLocaleLowerCase(locale)
                    .includes(search.trim().toLocaleLowerCase(locale)),
                )
                .map(row => (
                  <Pressable
                    key={row._id}
                    accessibilityRole="button"
                    onPress={() => {
                      setTarget(row._id);
                      setFailed(false);
                    }}
                    style={{
                      minHeight: 56,
                      justifyContent: 'center',
                      borderBottomWidth: 0.5,
                      borderBottomColor: colors.border,
                    }}>
                    <Text style={{ color: colors.text, fontSize: 15 }}>{title(row)}</Text>
                  </Pressable>
                ))
            )}
            {allowed &&
            !allowed.some(row =>
              title(row)
                .toLocaleLowerCase(locale)
                .includes(search.trim().toLocaleLowerCase(locale)),
            ) ? (
              <Text style={{ padding: 16, color: colors.secondary }}>{t.noResults}</Text>
            ) : null}
          </ScrollView>
        </>
      )}
      {failed ? (
        <Text accessibilityRole="alert" style={{ color: colors.text, paddingVertical: 12 }}>
          {t.actionFailed}
        </Text>
      ) : null}
      {selected ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void forward()}
          style={{
            minHeight: 44,
            borderRadius: 16,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.5 : 1,
          }}>
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>{t.forwardMessage}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
