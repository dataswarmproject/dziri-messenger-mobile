import React, { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
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
export function StoryComposer({
  close,
  initialCamera = false,
}: {
  close: () => void;
  initialCamera?: boolean;
}) {
  const colors = useColors(),
    { t, rtl } = useLocale();
  const media = useAttachment(true);
  const create = useMutation(dziriApi.storyCreate);
  const [body, setBody] = useState(''),
    [camera, setCamera] = useState(initialCamera),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const lock = useRef(false);
  async function publish() {
    if (lock.current || (!body.trim() && !media.attachment)) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const upload = media.attachment ? await media.upload() : null;
      await create({
        type: upload ? 'photo' : 'text',
        body: body.trim() || undefined,
        ...(upload ? { mediaStorageId: upload.storageId } : {}),
        audience: 'followers',
      });
      close();
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 32 }}>
        <View
          style={{
            height: 56,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
          }}>
          <IconButton name="close" label={t.cancel} color={colors.text} onPress={close} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{t.yourStory}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy || (!body.trim() && !media.attachment)}
            onPress={() => void publish()}
            style={{ padding: 12 }}>
            <Text style={{ color: colors.primary }}>{busy ? t.loading : t.publishStory}</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 13, color: colors.secondary, textAlign: 'center', padding: 12 }}>
          {t.storyAudience}
        </Text>
        {media.attachment ? (
          <View style={{ alignItems: 'center', padding: 16 }}>
            <MediaPreview media={media.attachment} />
            <IconButton
              name="close"
              label={t.cancel}
              color={colors.secondary}
              onPress={() => media.change(null)}
            />
          </View>
        ) : null}
        <TextInput
          multiline
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
            {t.failed}
          </Text>
        ) : null}
        <View style={{ padding: 16, flexDirection: rtl ? 'row-reverse' : 'row', gap: 16 }}>
          <FigmaButton name="photo" label={t.camera} onPress={() => setCamera(true)} />
          <FigmaButton name="gallery" label={t.photo} onPress={() => void media.choose()} />
        </View>
        <CameraCapture
          open={camera}
          close={() => setCamera(false)}
          captured={media.change}
          gallery={() => void media.choose()}
        />
      </View>
    </Modal>
  );
}
