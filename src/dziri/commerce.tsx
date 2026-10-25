import React, { useEffect, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Text, TextInput } from './typography';
import { useMutation, useQuery } from 'convex/react';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dziriApi } from './api';
import type { MessengerRoutes } from './routes';
import { useLocale } from './locale';
import { Notice, useColors } from './ui';
import { createTextSender } from './text-sender';

export function CommerceScreen(props: NativeStackScreenProps<MessengerRoutes, 'Commerce'>) {
  return (
    <Commerce
      key={`${props.route.params.conversationId}:${props.route.params.storeId ?? 'buyer'}`}
      {...props}
    />
  );
}

function Commerce({ route, navigation }: NativeStackScreenProps<MessengerRoutes, 'Commerce'>) {
  const { conversationId, storeId } = route.params;
  const scope = storeId ? { conversationId, storeId } : { conversationId };
  const { t, rtl } = useLocale();
  const colors = useColors();
  const me = useQuery(dziriApi.me, {});
  const detail = useQuery(dziriApi.commerceDetail, scope);
  const messages = useQuery(dziriApi.commerceMessages, detail ? { ...scope, limit: 100 } : 'skip');
  const send = useMutation(dziriApi.commerceSend);
  const sender = useMemo(
    () =>
      createTextSender(
        ({ threadId, body, clientMessageId }) =>
          send({
            conversationId: threadId,
            ...(storeId ? { storeId } : {}),
            content: body,
            clientMessageId,
          }),
        randomUUID,
      ),
    [send, storeId],
  );
  const markRead = useMutation(dziriApi.commerceRead);
  const focused = useIsFocused();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  const latest = messages?.at(-1)?._id;
  useEffect(() => {
    if (detail) navigation.setOptions({ title: detail.otherName });
  }, [detail, navigation]);
  useEffect(() => {
    if (focused && latest)
      void markRead(storeId ? { conversationId, storeId } : { conversationId }).catch(() => {});
  }, [focused, latest, conversationId, storeId, markRead]);
  if (detail === null || me === null) return <Notice text={t.failed} />;
  if (!detail || !me || !messages) return <Notice text={t.loading} busy />;
  async function submit() {
    const content = body.trim();
    if (!content || lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await sender.send(conversationId, content);
      setBody('');
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        inverted
        data={[...messages].reverse()}
        keyExtractor={message => message._id}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 12,
              alignItems: item.senderId === me._id ? 'flex-end' : 'flex-start',
            }}>
            <View
              style={{
                maxWidth: '85%',
                padding: 12,
                borderRadius: 14,
                backgroundColor: item.senderId === me._id ? colors.outgoing : colors.surface,
              }}>
              <Text
                selectable
                style={{
                  color: item.senderId === me._id ? colors.outgoingText : colors.text,
                  writingDirection: 'auto',
                }}>
                {item.deletedAt ? t.deleted : item.content}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ padding: 24, color: colors.secondary }}>{t.empty}</Text>}
      />
      {failed ? (
        <Text accessibilityRole="alert" style={{ padding: 12, color: colors.text }}>
          {t.commerceSendFailed}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: rtl ? 'row-reverse' : 'row',
          gap: 10,
          padding: 12,
          borderTopWidth: 1,
          borderColor: colors.border,
        }}>
        <TextInput
          accessibilityLabel={t.message}
          placeholder={t.message}
          placeholderTextColor={colors.secondary}
          value={body}
          onChangeText={setBody}
          editable={!busy}
          maxLength={8000}
          multiline
          style={{
            flex: 1,
            maxHeight: 120,
            minHeight: 48,
            borderRadius: 12,
            padding: 12,
            color: colors.text,
            backgroundColor: colors.surface,
          }}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy || !body.trim()}
          onPress={() => void submit()}
          style={{
            padding: 14,
            alignSelf: 'flex-end',
            borderRadius: 12,
            backgroundColor: colors.primary,
            opacity: busy || !body.trim() ? 0.5 : 1,
          }}>
          <Text style={{ color: '#fff' }}>{busy ? t.loading : t.send}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
