import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { dziriApi, type StoryRecord } from './api';
import { Text } from './typography';
import { IconButton } from './icons';
import { useLocale } from './locale';
import { MediaPreview } from './media-preview';
import { StoryReply } from './story-reply';
import { storyCopy, STORY_DURATION_MS, STORY_VIEW_DWELL_MS } from './messenger-stories.generated';
export function StoryViewer({
  items,
  close,
  openConversation,
}: {
  items: StoryRecord[];
  close: () => void;
  openConversation?: (threadId: string) => void;
}) {
  const [storyId, setStoryId] = useState(items[0]?._id),
    [progress, setProgress] = useState(0),
    [ready, setReady] = useState(false),
    [paused, setPaused] = useState(false),
    [held, setHeld] = useState(false),
    [replying, setReplying] = useState(false),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0),
    [playRequest, setPlayRequest] = useState(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const view = useMutation(dziriApi.storyView),
    { t, rtl, locale } = useLocale();
  const copy = storyCopy(locale),
    insets = useSafeAreaInsets();
  const index = items.findIndex(item => item._id === storyId);
  const story = index < 0 ? undefined : items[index];
  const running = active && !paused && !held && !replying && !failed;
  const missingMedia = !!story && story.type !== 'text' && !story.mediaUrl;
  const mediaStory = story?.type === 'video' || story?.type === 'voice';
  const currentAttempt = useRef(attempt);
  currentAttempt.current = attempt;
  const currentStoryId = useRef(story?._id);
  currentStoryId.current = story?._id;
  const select = useCallback(
    (position: number) => {
      if (!items[position]) {
        close();
        return;
      }
      setProgress(0);
      setReady(false);
      setPaused(false);
      setHeld(false);
      setReplying(false);
      setFailed(false);
      setAttempt(0);
      setStoryId(items[position]._id);
    },
    [items, close],
  );
  const viewed = useRef(new Set<string>());
  const playbackProgress = useCallback(
    (value: number) => {
      if (currentStoryId.current === storyId && currentAttempt.current === attempt)
        setProgress(Math.max(0, Math.min(1, value)));
    },
    [storyId, attempt],
  );
  const ended = useCallback(() => {
    if (currentStoryId.current === storyId && currentAttempt.current === attempt) setProgress(1);
  }, [storyId, attempt]);
  const mediaReady = useCallback(
    (value: boolean) => {
      if (currentStoryId.current === storyId && currentAttempt.current === attempt) setReady(value);
    },
    [storyId, attempt],
  );
  const failure = useCallback(() => {
    if (currentStoryId.current === storyId && currentAttempt.current === attempt) {
      setFailed(true);
      setReady(false);
    }
  }, [storyId, attempt]);
  function retry() {
    setFailed(false);
    setReady(story?.type === 'text');
    setProgress(0);
    setAttempt(value => value + 1);
    setPlayRequest(value => value + 1);
  }
  function toggle() {
    if (mediaStory && !ready && !paused) setPlayRequest(value => value + 1);
    else {
      setPaused(value => !value);
      if (paused) setPlayRequest(value => value + 1);
    }
  }
  const expiresAt = story?.expiresAt;
  useEffect(() => {
    if (expiresAt === undefined) {
      close();
      return;
    }
    // Wall-clock expiry is independent of loading, playback and progress ticks.
    const timer = setTimeout(close, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt, close]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', value => setActive(value === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    setReady(story?.type === 'text');
    setProgress(0);
  }, [story?._id, story?.type]);
  useEffect(() => {
    if (
      !story ||
      !ready ||
      !running ||
      story.expiresAt <= Date.now() ||
      viewed.current.has(story._id)
    )
      return;
    const timer = setTimeout(() => {
      if (story.expiresAt <= Date.now() || currentStoryId.current !== story._id) return;
      viewed.current.add(story._id);
      void view({ storyId: story._id }).catch(() => viewed.current.delete(story._id));
    }, STORY_VIEW_DWELL_MS);
    return () => clearTimeout(timer);
  }, [story, ready, running, view]);
  useEffect(() => {
    if (!ready || !running || (story?.type !== 'photo' && story?.type !== 'text')) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now(),
        delta = now - last;
      last = now;
      setProgress(value => Math.min(1, value + delta / STORY_DURATION_MS));
    }, 100);
    return () => clearInterval(timer);
  }, [ready, running, story?.type]);
  useEffect(() => {
    if (progress < 1 || !running) return;
    select(index + 1);
  }, [progress, index, select, running]);
  if (!story) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, direction: 'ltr' }}>
        <View
          style={{
            flex: 1,
            backgroundColor: '#000',
            paddingTop: Math.max(8, Platform.OS === 'ios' ? insets.top : 0),
            paddingBottom: Math.max(12, Platform.OS === 'ios' ? insets.bottom : 0),
          }}>
          <View pointerEvents="box-none" style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
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
              <Text
                numberOfLines={1}
                style={{ color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 }}>
                {story.authorName || story.authorHandle || t.unknown}
              </Text>
              <IconButton
                name={paused || (mediaStory && !ready) ? 'play' : 'pause'}
                label={paused || (mediaStory && !ready) ? copy.play : copy.pause}
                color="#fff"
                onPress={toggle}
              />
              <IconButton name="close" label={copy.close} color="#fff" onPress={close} />
            </View>
          </View>
          <View
            style={{
              flex: 1,
              borderRadius: 0,
              overflow: 'hidden',
              backgroundColor: story.backgroundHex || '#171717',
              justifyContent: 'center',
            }}>
            <Pressable
              accessible={false}
              disabled={mediaStory}
              onPressIn={() => {
                if (!mediaStory) setHeld(true);
              }}
              onPressOut={() => setHeld(false)}
              style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              {story.expiresAt <= Date.now() ? (
                <Text style={{ color: '#fff', textAlign: 'center' }}>{t.unavailable}</Text>
              ) : story.type === 'photo' && story.mediaUrl ? (
                <Image
                  key={story._id + ':' + attempt}
                  source={{ uri: story.mediaUrl }}
                  onLoad={() => mediaReady(true)}
                  onError={failure}
                  contentFit="contain"
                  style={{ width: '100%', height: '100%' }}
                />
              ) : story.mediaUrl ? (
                <MediaPreview
                  key={story._id + ':' + attempt}
                  media={{ uri: story.mediaUrl, type: story.type === 'voice' ? 'voice' : 'video' }}
                  onPlayingChange={mediaReady}
                  onProgress={playbackProgress}
                  onEnded={ended}
                  paused={!running}
                  autoPlay
                  playRequest={playRequest}
                  onError={failure}
                  fullScreen
                />
              ) : (
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 24,
                    lineHeight: 36,
                    textAlign: 'center',
                    padding: 24,
                  }}>
                  {story.body}
                </Text>
              )}
            </Pressable>
            {!ready && !failed && !missingMedia && story.type !== 'text' ? (
              <Text
                accessibilityRole="text"
                style={{
                  position: 'absolute',
                  alignSelf: 'center',
                  color: '#bbb',
                  fontSize: 13,
                  padding: 16,
                }}>
                {copy.loading}
              </Text>
            ) : null}
            {failed || missingMedia ? (
              <View
                style={{
                  position: 'absolute',
                  top: 80,
                  bottom: 64,
                  left: 0,
                  right: 0,
                  backgroundColor: '#171717',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  gap: 12,
                }}>
                <Text
                  accessibilityRole="alert"
                  style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>
                  {copy.failed}
                </Text>
                {!missingMedia ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={copy.retry}
                    onPress={retry}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 20,
                      borderRadius: 22,
                      backgroundColor: '#fff',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ color: '#111' }}>{copy.retry}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: '50%',
                left: 4,
                right: 4,
                flexDirection: rtl ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
              }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.previous}
                onPress={() => (index > 0 ? select(index - 1) : close())}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(0,0,0,.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ color: '#fff' }}>{rtl ? '›' : '‹'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.next}
                onPress={() => select(index + 1)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(0,0,0,.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ color: '#fff' }}>{rtl ? '‹' : '›'}</Text>
              </Pressable>
            </View>
          </View>
          <StoryReply
            key={story._id}
            storyId={story._id}
            authorId={story.authorId}
            close={close}
            onPauseChange={setReplying}
            openConversation={openConversation}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
