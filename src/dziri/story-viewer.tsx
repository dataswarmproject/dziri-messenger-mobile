import React, { useEffect, useState } from 'react';
import { AppState, Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation } from 'convex/react';
import { dziriApi, type StoryRecord } from './api';
import { Text } from './typography';
import { IconButton } from './icons';
import { useLocale } from './locale';
import { MediaPreview } from './media-preview';
export function StoryViewer({ items, close }: { items: StoryRecord[]; close: () => void }) {
  const [index, setIndex] = useState(0),
    [progress, setProgress] = useState(0),
    [ready, setReady] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const view = useMutation(dziriApi.storyView),
    { t, rtl } = useLocale();
  const story = items[index];
  useEffect(() => {
    const listener = AppState.addEventListener('change', value => setActive(value === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    setReady(story?.type === 'text');
    setProgress(0);
  }, [story?._id, story?.type]);
  useEffect(() => {
    if (!story || !ready || !active || story.expiresAt <= Date.now()) return;
    const timer = setTimeout(() => void view({ storyId: story._id }).catch(() => {}), 500);
    return () => clearTimeout(timer);
  }, [story, ready, active, view]);
  useEffect(() => {
    if (!ready || !active || (story?.type !== 'photo' && story?.type !== 'text')) return;
    const timer = setInterval(() => setProgress(value => Math.min(1, value + 0.02)), 100);
    return () => clearInterval(timer);
  }, [ready, active, story?.type]);
  useEffect(() => {
    if (progress < 1) return;
    if (index + 1 < items.length) setIndex(value => value + 1);
    else close();
  }, [progress, index, items.length, close]);
  if (!story) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: 44, paddingBottom: 44 }}>
        <View
          style={{
            flex: 1,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: story.backgroundHex || '#171717',
            justifyContent: 'center',
          }}>
          {story.expiresAt <= Date.now() ? (
            <Text style={{ color: '#fff', textAlign: 'center' }}>{t.unavailable}</Text>
          ) : story.type === 'photo' && story.mediaUrl ? (
            <Image
              source={{ uri: story.mediaUrl }}
              onLoad={() => setReady(true)}
              contentFit="contain"
              style={{ width: '100%', height: '100%' }}
            />
          ) : story.mediaUrl ? (
            <MediaPreview
              media={{ uri: story.mediaUrl, type: story.type === 'voice' ? 'voice' : 'video' }}
            />
          ) : (
            <Text
              style={{
                color: '#fff',
                fontSize: 28,
                lineHeight: 40,
                textAlign: 'center',
                padding: 24,
              }}>
              {story.body}
            </Text>
          )}
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 12, left: 12, right: 12 }}>
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 4 }}>
              {items.map((item, i) => (
                <View
                  key={item._id}
                  style={{ height: 2, flex: 1, backgroundColor: 'rgba(255,255,255,.4)' }}>
                  <View
                    style={{
                      height: 2,
                      width: `${i < index ? 100 : i === index ? Math.floor(progress * 100) : 0}%`,
                      backgroundColor: '#fff',
                    }}
                  />
                </View>
              ))}
            </View>
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 12,
                paddingTop: 8,
              }}>
              {story.authorImage ? (
                <Image
                  source={{ uri: story.authorImage }}
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                />
              ) : null}
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 }}>
                {story.authorName || story.authorHandle || t.unknown}
              </Text>
              <IconButton name="close" label={t.close} color="#fff" onPress={close} />
            </View>
          </View>
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              bottom: 20,
              left: 12,
              right: 12,
              flexDirection: rtl ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
            }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.back}
              onPress={() => (index > 0 ? setIndex(value => value - 1) : close())}
              style={{ padding: 16 }}>
              <Text style={{ color: '#fff' }}>‹</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.next}
              onPress={() => (index + 1 < items.length ? setIndex(value => value + 1) : close())}
              style={{ padding: 16 }}>
              <Text style={{ color: '#fff' }}>›</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
