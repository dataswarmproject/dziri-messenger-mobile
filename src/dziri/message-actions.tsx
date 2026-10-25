import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './typography';
import { Icon } from './icons';
import { useLocale } from './locale';
import { useColors } from './ui';
import { MessageStatus } from './message-status';
import type { DeliveryState } from './message-policy';
export function MessageActions({
  at,
  reply,
  react,
  retry,
  busy,
  expanded,
  status,
  info,
}: {
  at: number;
  reply?: () => void;
  react?: (emoji: string) => void;
  retry?: () => void;
  busy?: boolean;
  expanded: boolean;
  status?: DeliveryState;
  info: () => void;
}) {
  const { t, locale, rtl } = useLocale();
  const colors = useColors();
  const [picker, setPicker] = useState(false);
  return (
    <View style={{ gap: 2, maxWidth: '100%' }}>
      <View
        style={{
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 2,
          maxWidth: '100%',
        }}>
        <Text style={{ color: colors.secondary, fontSize: 11, flexShrink: 1 }}>
          {new Date(at).toLocaleString(locale, {
            ...(expanded ? ({ month: 'short', day: 'numeric', year: 'numeric' } as const) : {}),
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        {status ? <MessageStatus state={status} info={info} /> : null}
        {reply ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.reply}
            onPress={reply}
            hitSlop={6}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="reply" color={colors.secondary} size={18} />
          </Pressable>
        ) : null}
        {react ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.react}
            accessibilityState={{ disabled: busy, expanded: picker }}
            disabled={busy}
            hitSlop={6}
            onPress={() => setPicker(value => !value)}
            style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.55 : 1,
            }}>
            <Icon name="smile" color={colors.secondary} size={18} />
          </Pressable>
        ) : null}
        {retry ? (
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={{ padding: 12, minHeight: 44 }}>
            <Text style={{ color: colors.primary }}>{t.retryMessage}</Text>
          </Pressable>
        ) : null}
      </View>
      {picker && react ? (
        <View
          accessibilityLabel={t.react}
          style={{
            flexDirection: rtl ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            backgroundColor: colors.surface,
            borderRadius: 16,
            alignSelf: rtl ? 'flex-end' : 'flex-start',
          }}>
          {['❤️', '👍', '😂', '😮', '😢', '🙏'].map(emoji => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`${t.react} ${emoji}`}
              disabled={busy}
              onPress={() => {
                react(emoji);
                setPicker(false);
              }}
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
