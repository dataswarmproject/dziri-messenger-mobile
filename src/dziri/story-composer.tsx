import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { Text, TextInput } from './typography';
import { FigmaButton } from './figma';
import { IconButton } from './icons';
import { useColors } from './ui';
import { useLocale } from './locale';
import { dziriApi } from './api';
import { useAttachment } from './use-attachment';
import { MediaPreview } from './media-preview';
import { CameraCapture } from './camera';
import { storyCopy } from './messenger-stories.generated';
export function StoryComposer({
  close,
  initialCamera = false,
}: {
  close: () => void;
  initialCamera?: boolean;
}) {
  const colors = useColors(),
    { t, rtl, locale } = useLocale();
  const copy = storyCopy(locale),
    insets = useSafeAreaInsets();
  const media = useAttachment();
  const create = useMutation(dziriApi.storyCreate);
  const [body, setBody] = useState(''),
    [camera, setCamera] = useState(initialCamera),
    [audience, setAudience] = useState<'followers' | 'public'>('followers'),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const lock = useRef(false),
    epoch = useRef(0),
    mounted = useRef(true),
    closed = useRef(false);
  const abortUpload = useRef(media.cancelUpload);
  abortUpload.current = media.cancelUpload;
  const invalidate = useCallback(() => {
    epoch.current++;
    abortUpload.current();
  }, []);
  useEffect(() => {
    mounted.current = true;
    closed.current = false;
    return () => {
      mounted.current = false;
      invalidate();
    };
  }, [invalidate]);
  function cancel() {
    closed.current = true;
    epoch.current++;
    media.cancelUpload();
    setCamera(false);
    close();
  }
  function cancelUpload() {
    epoch.current++;
    media.cancelUpload();
    lock.current = false;
    setBusy(false);
  }

  async function publish() {
    if (lock.current || closed.current || !mounted.current || (!body.trim() && !media.attachment))
      return;
    lock.current = true;
    const attempt = ++epoch.current;
    const valid = () => mounted.current && !closed.current && attempt === epoch.current;
    setBusy(true);
    setFailed(false);
    try {
      const upload = media.attachment ? await media.upload() : null;
      if (!valid()) return;
      if (upload && upload.type !== 'image' && upload.type !== 'video')
        throw new Error('Unsupported story media');
      await create({
        type: upload ? (upload.type === 'video' ? 'video' : 'photo') : 'text',
        body: body.trim() || undefined,
        ...(upload
          ? {
              mediaStorageId: upload.storageId,
              ...(upload.duration ? { mediaDurationMs: upload.duration } : {}),
            }
          : {}),
        audience,
      });
      if (valid()) close();
    } catch {
      if (valid()) setFailed(true);
    } finally {
      if (valid()) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <Modal visible animationType="slide" onRequestClose={cancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, direction: 'ltr' }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            paddingTop: Math.max(8, Platform.OS === 'ios' ? insets.top : 0),
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
          }}>
          <View
            style={{
              height: 56,
              flexDirection: rtl ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 12,
            }}>
            <IconButton name="close" label={t.cancel} color={colors.text} onPress={cancel} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
              {t.yourStory}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy || (!body.trim() && !media.attachment)}
              onPress={() => void publish()}
              style={{ padding: 12 }}>
              <Text style={{ color: colors.primary }}>{busy ? t.loading : t.publishStory}</Text>
            </Pressable>
          </View>
          <View
            accessibilityLabel={copy.audience}
            style={{
              flexDirection: rtl ? 'row-reverse' : 'row',
              justifyContent: 'center',
              gap: 8,
              padding: 12,
            }}>
            {(['followers', 'public'] as const).map(value => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: audience === value }}
                disabled={busy}
                onPress={() => setAudience(value)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 16,
                  borderRadius: 22,
                  backgroundColor: audience === value ? colors.primary : colors.surface,
                  justifyContent: 'center',
                }}>
                <Text
                  style={{
                    fontSize: 13,
                    color: audience === value ? colors.onPrimary : colors.text,
                  }}>
                  {copy[value]}
                </Text>
              </Pressable>
            ))}
          </View>
          {media.busy ? (
            <View style={{ padding: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.secondary, fontSize: 12 }}>
                {t.uploading} {Math.round(media.progress * 100)}%
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={cancelUpload}
                style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: colors.text }}>{t.cancelUpload}</Text>
              </Pressable>
            </View>
          ) : null}
          {media.attachment ? (
            <View style={{ alignItems: 'center', padding: 16 }}>
              <MediaPreview media={media.attachment} />
              <IconButton
                name="close"
                label={t.cancel}
                color={colors.secondary}
                disabled={busy}
                onPress={() => media.change(null)}
              />
            </View>
          ) : null}
          <TextInput
            multiline
            editable={!busy}
            maxLength={2000}
            accessibilityLabel={t.yourStory}
            value={body}
            onChangeText={setBody}
            placeholder={t.message}
            placeholderTextColor={colors.secondary}
            style={{
              flex: 1,
              fontSize: 24,
              lineHeight: 34,
              color: colors.text,
              padding: 24,
              textAlignVertical: 'top',
            }}
          />
          {failed || media.failed ? (
            <Text accessibilityRole="alert" style={{ padding: 16, color: colors.text }}>
              {copy.failedPublish}
            </Text>
          ) : null}
          <View style={{ padding: 16, flexDirection: rtl ? 'row-reverse' : 'row', gap: 16 }}>
            <FigmaButton
              disabled={busy}
              name="photo"
              label={t.camera}
              onPress={() => setCamera(true)}
            />
            <FigmaButton
              disabled={busy}
              name="gallery"
              label={t.photo}
              onPress={() => void media.choose()}
            />
          </View>
          <CameraCapture
            open={camera}
            close={() => setCamera(false)}
            captured={value => {
              if (mounted.current && !closed.current && !lock.current) media.change(value);
            }}
            gallery={() => void media.choose()}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
