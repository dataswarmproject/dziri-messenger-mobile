import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './typography';
import { IconButton } from './icons';
import { useLocale } from './locale';
import { useColors } from './ui';
export function MessageActions({
  at,
  reply,
  react,
  retry,
  busy,
}: {
  at: number;
  reply?: () => void;
  react?: (emoji: string) => void;
  retry?: () => void;
  busy?: boolean;
}) {
  const { t, locale, rtl } = useLocale();
  const colors = useColors();
  const [picker, setPicker] = useState(false);
  return (
    <View style={{ gap: 4, alignSelf: 'stretch' }}>
      <View
        style={{
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 4,
        }}>
        <Text style={{ color: colors.secondary, fontSize: 11, flexShrink: 1 }}>
          {new Date(at).toLocaleString(locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        {reply ? (
          <IconButton name="reply" label={t.reply} color={colors.secondary} onPress={reply} />
        ) : null}
        {react ? (
          <IconButton
            name="smile"
            label={t.react}
            color={colors.secondary}
            busy={busy}
            onPress={() => setPicker(value => !value)}
          />
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
