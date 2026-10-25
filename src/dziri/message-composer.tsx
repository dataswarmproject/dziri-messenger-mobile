import React, { useEffect, useRef, useState } from 'react';
import { View, type TextInput as NativeInput } from 'react-native';
import { Text, TextInput } from './typography';
import { IconButton } from './icons';
import { ReplyQuote } from './message-bubble';
import type { ReplyPreview } from './api';
import { useLocale } from './locale';
import { useColors } from './ui';
export function MessageComposer({
  reply,
  cancelReply,
  submit,
  full = false,
}: {
  reply: ReplyPreview | null;
  cancelReply: () => void;
  submit: (body: string, reply?: ReplyPreview) => boolean;
  full?: boolean;
}) {
  const [body, setBody] = useState('');
  const input = useRef<NativeInput>(null);
  const { rtl, t } = useLocale();
  const colors = useColors();
  useEffect(() => {
    if (reply) input.current?.focus();
  }, [reply]);
  const disabled = !body.trim() || full;
  return (
    <View
      style={{ borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
      {reply ? (
        <View
          style={{
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingTop: 8,
          }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 11, color: colors.secondary }}>{t.replyingTo}</Text>
            <ReplyQuote reply={reply} />
          </View>
          <IconButton
            name="close"
            label={t.cancelReply}
            color={colors.secondary}
            onPress={cancelReply}
          />
        </View>
      ) : null}
      {full ? (
        <Text accessibilityRole="alert" style={{ color: colors.secondary, paddingHorizontal: 12 }}>
          {t.outboxFull}
        </Text>
      ) : null}
      <View
        style={{
          padding: 12,
          gap: 8,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
        }}>
        <TextInput
          ref={input}
          multiline
          maxLength={8000}
          value={body}
          onChangeText={setBody}
          placeholder={t.message}
          accessibilityLabel={t.message}
          placeholderTextColor={colors.secondary}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            maxHeight: 140,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 16,
            lineHeight: 23,
            borderRadius: 16,
            color: colors.text,
            backgroundColor: colors.surface,
            writingDirection: 'auto',
          }}
        />
        <View
          style={{
            borderRadius: 14,
            backgroundColor: colors.primary,
            opacity: disabled ? 0.45 : 1,
          }}>
          <IconButton
            name="send"
            label={t.send}
            color={colors.outgoingText}
            disabled={disabled}
            onPress={() => {
              if (submit(body, reply ?? undefined)) {
                setBody('');
                cancelReply();
              }
            }}
          />
        </View>
      </View>
    </View>
  );
}
