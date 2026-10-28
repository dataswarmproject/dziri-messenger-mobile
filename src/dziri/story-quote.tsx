import React, { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './typography';
import { Icon } from './icons';
import { useColors } from './ui';
import { useLocale } from './locale';
import { storyCopy, type StorySnapshot } from './messenger-stories.generated';
import { safeMediaUrl } from './message-media.generated';
export function StoryQuote({
  story,
  outgoing = false,
}: {
  story: StorySnapshot;
  outgoing?: boolean;
}) {
  const { locale, rtl } = useLocale(),
    copy = storyCopy(locale),
    colors = useColors(),
    [failed, setFailed] = useState(false);
  const color = outgoing ? colors.outgoingText : colors.text;
  const photo =
    story.type === 'photo' &&
    typeof story.mediaUrl === 'string' &&
    safeMediaUrl(story.mediaUrl) &&
    !failed;
  return (
    <View
      style={{
        flexDirection: rtl ? 'row-reverse' : 'row',
        gap: 8,
        padding: 8,
        marginBottom: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
      }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            story.type === 'text' ? story.backgroundHex || colors.surface : colors.surface,
        }}>
        {photo ? (
          <Image
            source={{ uri: story.mediaUrl! }}
            contentFit="cover"
            onError={() => setFailed(true)}
            style={{ width: 48, height: 48 }}
          />
        ) : story.type === 'video' || story.type === 'voice' ? (
          <Icon name="play" color={colors.text} />
        ) : (
          <Text
            numberOfLines={2}
            style={{
              color: story.backgroundHex ? '#fff' : colors.text,
              fontSize: 11,
              textAlign: 'center',
              padding: 4,
            }}>
            {story.body?.split(/\s+/).slice(0, 2).join(' ') || 'Aa'}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color, fontSize: 11, opacity: 0.7 }}>{copy.quote}</Text>
        {story.authorName ? (
          <Text numberOfLines={1} style={{ color, fontSize: 12, fontWeight: '600' }}>
            {story.authorName}
          </Text>
        ) : null}
        {story.body ? (
          <Text numberOfLines={1} style={{ color, fontSize: 11, opacity: 0.7 }}>
            {story.body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
