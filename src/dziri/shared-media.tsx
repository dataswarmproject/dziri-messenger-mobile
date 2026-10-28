import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from './typography';
import { MediaPreview, type MessageMedia } from './media-preview';
import { librarySection, sharedLinks } from './message-media.generated';
import { useLocale } from './locale';
import { useColors } from './ui';
import { Icon } from './icons';
type Row = {
  id: string;
  body?: string;
  media?: MessageMedia;
  deletedAt?: number;
  ciphertext?: unknown;
  moderationStatus?: string;
};
export function SharedMedia({
  rows,
  status,
  loadMore,
  limited = false,
}: {
  rows: Row[];
  status: string;
  loadMore: () => void;
  limited?: boolean;
}) {
  const [tab, setTab] = useState<'media' | 'audio' | 'files' | 'links'>('media');
  const [failed, setFailed] = useState(false);
  const { t, rtl } = useLocale(),
    colors = useColors();
  const items = rows.map(row => ({ ...row, type: row.media?.type, mediaUrl: row.media?.uri }));
  const media = items.filter(row => librarySection(row) === tab);
  const links = sharedLinks(items);
  const complete = status === 'Exhausted' && !limited;
  async function open(uri: string) {
    setFailed(false);
    try {
      await Linking.openURL(uri);
    } catch {
      setFailed(true);
    }
  }
  return (
    <View style={{ gap: 12, paddingTop: 20 }}>
      <Text accessibilityRole="header" style={{ fontSize: 13, color: colors.secondary }}>
        {t.sharedContent}
      </Text>
      <View
        accessibilityRole="tablist"
        style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 4 }}>
        {(['media', 'audio', 'files', 'links'] as const).map(value => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            aria-selected={tab === value}
            onPress={() => setTab(value)}
            style={{
              minHeight: 44,
              paddingHorizontal: 12,
              justifyContent: 'center',
              borderRadius: 12,
              backgroundColor: tab === value ? colors.surface : 'transparent',
            }}>
            <Text style={{ fontSize: 13, color: tab === value ? colors.text : colors.secondary }}>
              {t[value]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: colors.secondary }}>
        {complete ? t.sharedComplete : limited ? t.historyLimited : t.sharedLoaded}
      </Text>
      {failed ? (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {t.openFileFailed}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: tab === 'media' ? (rtl ? 'row-reverse' : 'row') : 'column',
          flexWrap: 'wrap',
          gap: 12,
        }}>
        {tab === 'links'
          ? links.map(uri => (
              <Pressable
                key={uri}
                accessibilityRole="link"
                accessibilityLabel={uri}
                onPress={() => void open(uri)}
                style={{
                  minHeight: 44,
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  gap: 12,
                  alignItems: 'center',
                }}>
                <Icon name="link" color={colors.text} />
                <Text numberOfLines={2} style={{ color: colors.text, flex: 1, fontSize: 14 }}>
                  {uri}
                </Text>
              </Pressable>
            ))
          : media.map(row => (
              <View key={row.id} style={{ maxWidth: '100%' }}>
                <MediaPreview
                  media={row.media!}
                  thumbnailSize={tab === 'media' && row.media?.type !== 'video' ? 100 : undefined}
                />
              </View>
            ))}
      </View>
      {(tab === 'links' ? links.length : media.length) === 0 ? (
        <Text style={{ color: colors.secondary, fontSize: 13 }}>
          {complete ? t.sharedEmpty : t.sharedEmptyLoaded}
        </Text>
      ) : null}
      {status === 'LoadingFirstPage' || status === 'LoadingMore' ? (
        <Text accessibilityRole="progressbar" style={{ color: colors.secondary }}>
          {t.loading}
        </Text>
      ) : status === 'CanLoadMore' && !limited ? (
        <Pressable
          accessibilityRole="button"
          onPress={loadMore}
          style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: colors.primary }}>{t.older}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
