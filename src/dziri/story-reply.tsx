import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { randomUUID, digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { useQuery, useMutation } from 'convex/react';
import { Text, TextInput } from './typography';
import { IconButton } from './icons';
import { useLocale } from './locale';
import { dziriApi } from './api';
import {
  storyCopy,
  STORY_REACTIONS,
  storyReplyCommand,
  storyReplyAccepted,
  storyReplyConfirmed,
  validStoryPreparation,
  storyReplyPayload,
  type StoryReplyCommand,
} from './messenger-stories.generated';
async function hashStoryIntent(intent: StoryReplyCommand) {
  return (
    'v1:' +
    (await digestStringAsync(CryptoDigestAlgorithm.SHA256, storyReplyPayload(intent))).toLowerCase()
  );
}
type Props = {
  storyId: string;
  authorId: string;
  onPauseChange: (value: boolean) => void;
  close: () => void;
  openConversation?: (threadId: string) => void;
};
export function StoryReply(props: Props) {
  const me = useQuery(dziriApi.me, {}),
    caps = useQuery(dziriApi.capabilities, {});
  if (!me?._id || me._id === props.authorId) return null;
  return (
    <ReplyControls
      key={me._id + ':' + props.storyId}
      {...props}
      actorId={me._id}
      supported={caps?.features?.storyReplies === 1 && caps?.features?.storyWriteScope === 1}
    />
  );
}
function ReplyControls({
  storyId,
  authorId,
  onPauseChange,
  close,
  openConversation,
  actorId,
  supported,
}: Props & { actorId: string; supported: boolean }) {
  const { locale, rtl } = useLocale(),
    copy = storyCopy(locale),
    reply = useMutation(dziriApi.storyReply),
    react = useMutation(dziriApi.storyReaction),
    open = useMutation(dziriApi.createDm);
  const [body, setBody] = useState(''),
    [focused, setFocused] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<'sent' | 'send-failed' | 'open-failed' | null>(null),
    [pending, setPending] = useState<StoryReplyCommand | null>(null);
  const prepared = useQuery(
    dziriApi.storyPrepare,
    supported
      ? {
          storyId,
          expectedActorId: actorId,
          ...(pending?.payloadHash
            ? {
                pendingCommand: {
                  clientMessageId: pending.clientMessageId,
                  payloadHash: pending.payloadHash,
                },
              }
            : {}),
        }
      : 'skip',
  );
  const command = useRef<StoryReplyCommand | null>(null),
    locked = useRef(false),
    mounted = useRef(true),
    operation = useRef(0),
    bodyRef = useRef(body),
    preparedRef = useRef(prepared),
    pauseRef = useRef(onPauseChange),
    supportedRef = useRef(supported);
  supportedRef.current = supported;
  bodyRef.current = body;
  preparedRef.current = prepared;
  pauseRef.current = onPauseChange;
  const canReply = supported && validStoryPreparation(prepared, actorId) && prepared.canSend;
  const retryAllowed = !!pending && supported && storyReplyAccepted(pending, prepared, actorId);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current++;
      locked.current = false;
      pauseRef.current(false);
    };
  }, []);
  useEffect(
    () =>
      onPauseChange(
        focused || !!body.trim() || busy || status === 'send-failed' || status === 'open-failed',
      ),
    [focused, body, busy, status, onPauseChange],
  );
  function finish(intent: StoryReplyCommand) {
    if (
      !mounted.current ||
      !supportedRef.current ||
      command.current !== intent ||
      !storyReplyAccepted(intent, preparedRef.current, actorId)
    )
      return;
    operation.current++;
    locked.current = false;
    command.current = null;
    setPending(null);
    setBusy(false);
    if (intent.kind === 'reply' && bodyRef.current.trim() === intent.body) setBody('');
    setStatus('sent');
  }
  useEffect(() => {
    const intent = command.current;
    if (!supported) {
      operation.current++;
      locked.current = false;
      setBusy(false);
      if (intent) setStatus('send-failed');
      return;
    }
    if (!intent) return;
    if (storyReplyConfirmed(intent, prepared, actorId)) finish(intent);
    else if (prepared !== undefined && !storyReplyAccepted(intent, prepared, actorId)) {
      operation.current++;
      locked.current = false;
      setBusy(false);
      setStatus('send-failed');
    }
  }, [prepared, actorId, supported]);
  async function send(kind: 'reply' | 'reaction', text: string, retry?: StoryReplyCommand) {
    if (!mounted.current || !supportedRef.current || locked.current || !text.trim()) return;
    const live = preparedRef.current,
      previous = command.current;
    if (
      retry
        ? previous !== retry || !storyReplyAccepted(retry, live, actorId)
        : !validStoryPreparation(live, actorId) || !live.canSend
    )
      return;
    let intent = retry
      ? retry
      : storyReplyCommand(previous, storyId, kind, text, randomUUID, live!.writeContext);
    if (!intent.commandContext) return;
    const ticket = ++operation.current;
    command.current = intent;
    locked.current = true;
    setBusy(true);
    setStatus(null);
    setPending(intent);
    try {
      if (!intent.payloadHash) {
        const payloadHash = await hashStoryIntent(intent);
        if (!mounted.current || !supportedRef.current || ticket !== operation.current) return;
        intent = Object.freeze({ ...intent, payloadHash });
        command.current = intent;
      }
      if (!storyReplyAccepted(intent, preparedRef.current, actorId)) {
        setStatus('send-failed');
        return;
      }
      setPending(intent);
      if (intent.kind === 'reply')
        await reply({
          storyId,
          body: intent.body,
          clientMessageId: intent.clientMessageId,
          commandContext: intent.commandContext!,
        });
      else
        await react({
          storyId,
          emoji: intent.body,
          clientMessageId: intent.clientMessageId,
          commandContext: intent.commandContext!,
        });
      if (mounted.current && ticket === operation.current) {
        if (storyReplyAccepted(intent, preparedRef.current, actorId)) finish(intent);
        else setStatus('send-failed');
      }
    } catch {
      if (mounted.current && ticket === operation.current) setStatus('send-failed');
    } finally {
      if (mounted.current && ticket === operation.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  async function openChat() {
    if (!mounted.current || !supportedRef.current || locked.current || !openConversation) return;
    const ticket = ++operation.current;
    locked.current = true;
    setBusy(true);
    setStatus(null);
    try {
      const id = await open({ otherUserId: authorId, expectedActorId: actorId });
      if (mounted.current && ticket === operation.current) {
        close();
        openConversation!(id);
      }
    } catch {
      if (mounted.current && ticket === operation.current) setStatus('open-failed');
    } finally {
      if (mounted.current && ticket === operation.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  if (!supported && !body && !pending)
    return (
      <Text style={{ color: '#aaa', fontSize: 12, padding: 12, textAlign: 'center' }}>
        {copy.unavailable}
      </Text>
    );
  if (prepared && prepared.writeContext.expectedActorId !== actorId)
    return (
      <Text accessibilityRole="text" style={{ color: '#aaa', padding: 12 }}>
        {copy.loading}
      </Text>
    );
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8, gap: 8 }}>
      {status ? (
        <View style={{ alignItems: 'center' }}>
          <Text
            accessibilityRole={status === 'sent' ? 'text' : 'alert'}
            style={{ color: '#ddd', fontSize: 12 }}>
            {status === 'sent' ? copy.sent : pending && !retryAllowed ? copy.held : copy.sendFailed}
          </Text>
          {status === 'send-failed' && pending ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.retry}
              onPress={() => {
                const intent = pending!;
                void send(intent.kind, intent.body, intent);
              }}
              disabled={busy || !retryAllowed}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}>
              <Text style={{ color: '#fff', fontSize: 13 }}>{copy.retry}</Text>
            </Pressable>
          ) : null}
          {status === 'open-failed' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.retry}
              onPress={() => void openChat()}
              disabled={busy || !supported}
              style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 13 }}>{copy.retry}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {!canReply && !busy && !status ? (
        <Text accessibilityRole="text" style={{ color: '#aaa', fontSize: 12, textAlign: 'center' }}>
          {!supported
            ? copy.unavailable
            : prepared === undefined
              ? copy.loading
              : copy.replyUnavailable}
        </Text>
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
            opacity: busy || !body.trim() || !canReply ? 0.4 : 1,
          }}>
          <IconButton
            name="send"
            label={copy.send}
            color="#000"
            busy={busy}
            disabled={!body.trim() || !canReply}
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
            disabled={busy || !canReply}
            onPress={() => void send('reaction', emoji)}
            style={{
              minWidth: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy || !canReply ? 0.4 : 1,
            }}>
            <Text style={{ fontSize: 24 }}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
      {openConversation ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.open}
          disabled={busy || !supported}
          onPress={() => void openChat()}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: '#aaa' }}>{copy.open}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
