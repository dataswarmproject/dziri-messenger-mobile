import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from 'convex/react';
import { dziriApi, type StoryRecord } from './api';
import { Text } from './typography';
import { useColors } from './ui';
import { useLocale } from './locale';
import { StoryViewer } from './story-viewer';
import { StoryComposer } from './story-composer';
export function StoriesStrip({
  openConversation,
}: { openConversation?: (threadId: string) => void } = {}) {
  const stories = useQuery(dziriApi.stories, {}),
    { t, rtl } = useLocale();
  const colors = useColors();
  const [selected, setSelected] = useState<string | null>(null),
    [create, setCreate] = useState(false);
  const groups = new Map<string, StoryRecord[]>();
  for (const story of stories ?? []) {
    if (
      story.expiresAt <= Date.now() ||
      story.moderationStatus === 'blocked' ||
      story.moderationStatus === 'blurred'
    )
      continue;
    const group = groups.get(story.authorId) ?? [];
    group.push(story);
    groups.set(story.authorId, group);
  }
  const selectedItems = selected ? groups.get(selected) : undefined;
  const selectedAvailable = !!selectedItems?.length;
  useEffect(() => {
    if (selected && stories !== undefined && !selectedAvailable) setSelected(null);
  }, [selected, selectedAvailable, stories]);
  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 106 }}
        contentContainerStyle={{
          height: 106,
          paddingTop: 14,
          paddingHorizontal: 12,
          gap: 15,
          flexDirection: rtl ? 'row-reverse' : 'row',
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.yourStory}
          onPress={() => setCreate(true)}
          style={{ width: 65, alignItems: 'center', gap: 7 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text style={{ color: colors.text, fontSize: 32, lineHeight: 38 }}>+</Text>
          </View>
          <Text numberOfLines={1} style={{ fontSize: 13, color: colors.secondary }}>
            {t.yourStory}
          </Text>
        </Pressable>
        {[...groups.values()].map(items => {
          const story = items[0];
          return (
            <Pressable
              key={story.authorId}
              accessibilityRole="button"
              accessibilityLabel={story.authorName || story.authorHandle || t.stories}
              onPress={() => setSelected(story.authorId)}
              style={{ width: 65, alignItems: 'center', gap: 7 }}>
              <View
                style={{
                  padding: 2,
                  borderRadius: 30,
                  borderWidth: items.some(item => !item.iHaveViewed) ? 2 : 0,
                  borderColor: colors.primary,
                }}>
                {story.authorImage ? (
                  <Image
                    source={{ uri: story.authorImage }}
                    style={{ width: 48, height: 48, borderRadius: 24 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ color: colors.secondary }}>{(story.authorName || '?')[0]}</Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={{ fontSize: 13, color: colors.secondary }}>
                {story.authorName || story.authorHandle}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {selectedItems ? (
        <StoryViewer
          items={selectedItems}
          close={() => setSelected(null)}
          openConversation={openConversation}
        />
      ) : null}
      {create ? <StoryComposer close={() => setCreate(false)} /> : null}
    </>
  );
}
