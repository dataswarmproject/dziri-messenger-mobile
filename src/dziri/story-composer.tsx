import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { Text, TextInput } from './typography';
import { FigmaButton } from './figma';
import { Icon, IconButton } from './icons';
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
  const copy = storyCopy(locale);
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
        ...(!upload ? { backgroundHex: '#151515' } : {}),
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
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={cancel}>
      <SafeAreaProvider>
        <SafeAreaView
          edges={['top', 'bottom', 'left', 'right']}
          style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, direction: 'ltr' }}>
            <View
              style={{
                flex: 1,
                backgroundColor: colors.background,
                paddingTop: 4,
              }}>
              <View
                style={{
                  minHeight: 56,
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 12,
                }}>
                <IconButton name="close" label={t.cancel} color={colors.text} onPress={cancel} />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: 16,
                    fontWeight: '700',
                    color: colors.text,
                  }}>
                  {t.yourStory}
                </Text>
                <View style={{ width: 44 }} />
              </View>
              <View
                style={{
                  flex: 1,
                  minHeight: 0,
                  marginHorizontal: 12,
                  borderRadius: 24,
                  overflow: 'hidden',
                  backgroundColor: '#151515',
                  justifyContent: 'center',
                }}>
                {media.attachment ? (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    {media.attachment.type === 'image' ? (
                      <Image
                        source={{ uri: media.attachment.uri }}
                        contentFit="contain"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <MediaPreview media={media.attachment} fullScreen />
                    )}
                  </View>
                ) : null}
                {media.attachment ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: rtl ? undefined : 8,
                      left: rtl ? 8 : undefined,
                      zIndex: 1,
                      borderRadius: 22,
                      backgroundColor: '#0009',
                    }}>
                    <IconButton
                      name="close"
                      label={t.cancel}
                      color="#fff"
                      disabled={busy}
                      onPress={() => media.change(null)}
                    />
                  </View>
                ) : null}
                <View
                  style={{
                    flex: 1,
                    minHeight: 0,
                    justifyContent: media.attachment ? 'flex-end' : 'center',
                    paddingVertical: 24,
                  }}
                  pointerEvents="box-none">
                  <TextInput
                    multiline
                    editable={!busy}
                    maxLength={media.attachment ? 200 : 280}
                    accessibilityLabel={t.yourStory}
                    value={body}
                    onChangeText={setBody}
                    placeholder={
                      locale === 'ar'
                        ? 'اكتب شيئاً…'
                        : locale === 'fr'
                          ? 'Écrivez quelque chose…'
                          : 'Write something…'
                    }
                    placeholderTextColor="#ffffff80"
                    style={{
                      minHeight: media.attachment ? 64 : 104,
                      maxHeight: '100%',
                      fontSize: media.attachment
                        ? 20
                        : body.length > 160
                          ? 22
                          : body.length > 80
                            ? 26
                            : 32,
                      lineHeight: media.attachment
                        ? 28
                        : body.length > 160
                          ? 30
                          : body.length > 80
                            ? 34
                            : 42,
                      fontWeight: '600',
                      color: '#fff',
                      padding: 24,
                      textAlign: 'center',
                      textAlignVertical: 'center',
                      writingDirection: 'auto',
                      backgroundColor: media.attachment ? '#0008' : 'transparent',
                    }}
                  />
                </View>
              </View>
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 }}>
                {media.busy ? (
                  <View style={{ alignItems: 'center' }}>
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
                {failed || media.failed ? (
                  <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 13 }}>
                    {copy.failedPublish}
                  </Text>
                ) : null}
                <View
                  style={{
                    flexDirection: rtl ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                  <View
                    style={{
                      flexDirection: rtl ? 'row-reverse' : 'row',
                      gap: 4,
                      borderRadius: 24,
                      backgroundColor: colors.surface,
                      paddingHorizontal: 4,
                    }}>
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
                  <View
                    accessibilityLabel={copy.audience}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      flexDirection: rtl ? 'row-reverse' : 'row',
                      justifyContent: 'flex-end',
                      gap: 4,
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
                          paddingHorizontal: 10,
                          borderRadius: 22,
                          justifyContent: 'center',
                          backgroundColor: audience === value ? colors.surface : 'transparent',
                        }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 12,
                            fontWeight: audience === value ? '600' : '400',
                            color: audience === value ? colors.text : colors.secondary,
                          }}>
                          {copy[value]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.publishStory}
                  accessibilityState={{
                    disabled: busy || (!body.trim() && !media.attachment),
                    busy,
                  }}
                  disabled={busy || (!body.trim() && !media.attachment)}
                  onPress={() => void publish()}
                  style={{
                    minHeight: 48,
                    borderRadius: 24,
                    backgroundColor: colors.primary,
                    flexDirection: rtl ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: busy || (!body.trim() && !media.attachment) ? 0.4 : 1,
                  }}>
                  <Icon name="send" size={18} color={colors.onPrimary} />
                  <Text style={{ color: colors.onPrimary, fontSize: 14, fontWeight: '700' }}>
                    {busy ? copy.publishing : t.publishStory}
                  </Text>
                </Pressable>
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
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
