import React from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from 'convex/react';
import { dziriApi } from './api';
import { Text } from './typography';
import { useColors } from './ui';
import { useLocale } from './locale';
export function PinnedMessages({
  threadId,
  open,
}: {
  threadId: string;
  open: (id: string) => void;
}) {
  const rows = useQuery(dziriApi.pinnedMessages, { threadId }),
    colors = useColors(),
    { t } = useLocale();
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
      <Text style={{ fontSize: 13, color: colors.secondary, paddingVertical: 12 }}>
        {t.pinnedMessages.toUpperCase()}
      </Text>
      {rows === undefined ? (
        <Text style={{ color: colors.secondary }}>{t.loading}</Text>
      ) : rows.length ? (
        rows.map(row => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            onPress={() => open(row.id)}
            style={{
              minHeight: 52,
              paddingVertical: 12,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.border,
            }}>
            <Text numberOfLines={2} style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>
              {row.body || t.media}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text style={{ fontSize: 13, color: colors.secondary }}>{t.noPinnedMessages}</Text>
      )}
    </View>
  );
}
