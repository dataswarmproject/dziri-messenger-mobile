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
import { Icon } from './icons';
export function StoriesStrip({
  openConversation,
  avatar,
}: { openConversation?: (threadId: string) => void; avatar?: string } = {}) {
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
        style={{ maxHeight: 84 }}
        contentContainerStyle={{
          height: 84,
          paddingTop: 4,
          paddingBottom: 8,
          paddingHorizontal: 12,
          gap: 12,
          flexDirection: rtl ? 'row-reverse' : 'row',
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.yourStory}
          onPress={() => setCreate(true)}
          style={{ width: 64, alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            {avatar ? (
              <Image
                source={{ uri: avatar }}
                contentFit="cover"
                style={{ width: 48, height: 48, borderRadius: 24 }}
              />
            ) : (
              <Image
                source={require('../../assets/dziri-ring.svg')}
                contentFit="contain"
                tintColor={colors.text}
                style={{ width: 28, height: 28 }}
              />
            )}
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="plainPlus" color={colors.onPrimary} size={12} />
            </View>
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
              style={{ width: 64, alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  padding: 2,
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  borderWidth: 2,
                  borderColor: items.some(item => !item.iHaveViewed)
                    ? colors.primary
                    : 'transparent',
                }}>
                {story.authorImage ? (
                  <Image
                    source={{ uri: story.authorImage }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
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
