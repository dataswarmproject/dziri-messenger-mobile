import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { useQuery, useMutation } from 'convex/react';
import { Text, TextInput } from './typography';
import { IconButton } from './icons';
import { useLocale } from './locale';
import { dziriApi } from './api';
import {
  storyCopy,
  STORY_REACTIONS,
  storyReplyCommand,
  type StoryReplyCommand,
} from './messenger-stories.generated';
type Props = {
  storyId: string;
  authorId: string;
  onPauseChange: (value: boolean) => void;
  close: () => void;
  openConversation?: (threadId: string) => void;
};
export function StoryReply(props: Props) {
  const me = useQuery(dziriApi.me, {}),
    caps = useQuery(dziriApi.capabilities, {}),
    { locale } = useLocale(),
    copy = storyCopy(locale);
  if (!me?._id || me._id === props.authorId) return null;
  if (caps?.features?.storyReplies !== 1)
    return (
      <Text style={{ color: '#aaa', fontSize: 12, padding: 12, textAlign: 'center' }}>
        {copy.unavailable}
      </Text>
    );
  return <ReplyControls key={me._id + ':' + props.storyId} {...props} />;
}
function ReplyControls({ storyId, authorId, onPauseChange, close, openConversation }: Props) {
  const { locale, rtl } = useLocale(),
    copy = storyCopy(locale),
    reply = useMutation(dziriApi.storyReply),
    react = useMutation(dziriApi.storyReaction),
    open = useMutation(dziriApi.createDm);
  const [body, setBody] = useState(''),
    [focused, setFocused] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<'sent' | 'send-failed' | 'open-failed' | null>(null);
  const command = useRef<StoryReplyCommand | null>(null),
    locked = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      onPauseChange(false);
    };
  }, [onPauseChange]);
  useEffect(
    () =>
      onPauseChange(
        focused || !!body.trim() || busy || status === 'send-failed' || status === 'open-failed',
      ),
    [focused, body, busy, status, onPauseChange],
  );
  async function send(kind: 'reply' | 'reaction', text: string) {
    if (locked.current || !text.trim()) return;
    locked.current = true;
    setBusy(true);
    setStatus(null);
    const intent = storyReplyCommand(command.current, storyId, kind, text, randomUUID);
    command.current = intent;
    try {
      if (kind === 'reply')
        await reply({ storyId, body: intent.body, clientMessageId: intent.clientMessageId });
      else await react({ storyId, emoji: intent.body, clientMessageId: intent.clientMessageId });
      if (mounted.current) {
        command.current = null;
        if (kind === 'reply') setBody('');
        setStatus('sent');
      }
    } catch {
      if (mounted.current) setStatus('send-failed');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function openChat() {
    if (locked.current || !openConversation) return;
    locked.current = true;
    setBusy(true);
    setStatus(null);
    try {
      const id = await open({ otherUserId: authorId });
      if (mounted.current) {
        close();
        openConversation(id);
      }
    } catch {
      if (mounted.current) setStatus('open-failed');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8, gap: 8 }}>
      {status ? (
        <View style={{ alignItems: 'center' }}>
          <Text
            accessibilityRole={status === 'sent' ? 'text' : 'alert'}
            style={{ color: '#ddd', fontSize: 12 }}>
            {status === 'sent' ? copy.sent : copy.sendFailed}
          </Text>
          {status === 'send-failed' && command.current ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.retry}
              onPress={() => {
                const intent = command.current!;
                void send(intent.kind, intent.body);
              }}
              disabled={busy}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}>
              <Text style={{ color: '#fff', fontSize: 13 }}>{copy.retry}</Text>
            </Pressable>
          ) : null}
          {status === 'open-failed' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.retry}
              onPress={() => void openChat()}
              disabled={busy}
              style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 13 }}>{copy.retry}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={body}
          onChangeText={text => {
            setBody(text);
            setStatus(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!busy}
          accessibilityLabel={copy.reply}
          placeholder={copy.reply}
          placeholderTextColor="#999"
          maxLength={600}
          returnKeyType="send"
          onSubmitEditing={() => void send('reply', body)}
          style={{
            flex: 1,
            minWidth: 0,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#292929',
            color: '#fff',
            paddingHorizontal: 16,
            fontSize: 14,
          }}
        />
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#fff',
            opacity: busy || !body.trim() ? 0.4 : 1,
          }}>
          <IconButton
            name="send"
            label={copy.send}
            color="#000"
            busy={busy}
            disabled={!body.trim()}
            onPress={() => void send('reply', body)}
          />
        </View>
      </View>
      <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-around' }}>
        {STORY_REACTIONS.map(emoji => (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={`${copy.reaction} ${emoji}`}
            disabled={busy}
            onPress={() => void send('reaction', emoji)}
            style={{
              minWidth: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.4 : 1,
            }}>
            <Text style={{ fontSize: 24 }}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
      {openConversation ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.open}
          disabled={busy}
          onPress={() => void openChat()}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: '#aaa' }}>{copy.open}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
