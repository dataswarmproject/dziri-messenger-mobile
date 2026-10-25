import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  View,
  type TextStyle,
  type TextInput as NativeInput,
} from 'react-native';
import { Text, TextInput } from './typography';
import { IconButton } from './icons';
import { FigmaButton } from './figma';
import { ReplyQuote } from './message-bubble';
import type { ReplyPreview } from './api';
import { useLocale } from './locale';
import { useColors } from './ui';
import type { UploadedMedia } from './media-upload';
import { useAttachment } from './use-attachment';
import { MediaPreview } from './media-preview';
import { CameraCapture } from './camera';
import { messageDirection } from './typeface';
// RN's native outline enum omits CSS `none`; this style is only used on web.
const browserInputStyle =
  Platform.OS === 'web'
    ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle)
    : undefined;
export function MessageComposer({
  reply,
  cancelReply,
  submit,
  submitMedia,
  full = false,
  imagesOnly = false,
}: {
  reply: ReplyPreview | null;
  cancelReply: () => void;
  submit: (body: string, reply?: ReplyPreview) => boolean;
  submitMedia?: (media: UploadedMedia, text: string, reply?: ReplyPreview) => boolean;
  full?: boolean;
  imagesOnly?: boolean;
}) {
  const [body, setBody] = useState(''),
    [tools, setTools] = useState(false),
    [emoji, setEmoji] = useState(false),
    [camera, setCamera] = useState(false),
    [sending, setSending] = useState(false),
    [inputHeight, setInputHeight] = useState(44);
  const input = useRef<NativeInput>(null),
    lock = useRef(false);
  const { rtl, t } = useLocale();
  const colors = useColors();
  const direction = messageDirection(body, rtl);
  const media = useAttachment(imagesOnly);
  useEffect(() => {
    if (reply) input.current?.focus();
  }, [reply]);
  async function send() {
    if (lock.current || full) return;
    lock.current = true;
    setSending(true);
    try {
      const accepted =
        media.attachment && submitMedia
          ? submitMedia(await media.upload(), body, reply ?? undefined)
          : submit(body || '👍', reply ?? undefined);
      if (accepted) {
        setBody('');
        media.change(null);
        cancelReply();
        setTools(false);
      }
    } catch {
    } finally {
      setSending(false);
      lock.current = false;
    }
  }
  return (
    <View style={{ backgroundColor: colors.background, direction: 'ltr' }}>
      {reply ? (
        <View
          style={{
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingTop: 8,
          }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 11, color: colors.secondary }}>{t.replyingTo}</Text>
            <ReplyQuote reply={reply} />
          </View>
          <IconButton
            name="close"
            label={t.cancelReply}
            color={colors.secondary}
            onPress={cancelReply}
          />
        </View>
      ) : null}
      {full || media.failed ? (
        <Text accessibilityRole="alert" style={{ color: colors.secondary, padding: 12 }}>
          {full ? t.outboxFull : t.mediaFailed}
        </Text>
      ) : null}
      {media.attachment ? (
        <View
          style={{
            padding: 12,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <MediaPreview media={media.attachment} />
          </View>
          <IconButton
            name="close"
            label={t.cancel}
            color={colors.secondary}
            disabled={sending}
            onPress={() => media.change(null)}
          />
        </View>
      ) : null}
      {media.recording ? (
        <View
          style={{
            padding: 12,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <Text accessibilityRole="alert" style={{ color: colors.text, flex: 1 }}>
            {t.recording} · {media.seconds}s
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void media.finishVoice()}
            style={{ padding: 12 }}>
            <Text style={{ color: colors.primary }}>{t.stop}</Text>
          </Pressable>
        </View>
      ) : null}
      {tools && submitMedia ? (
        <View
          style={{
            flexDirection: rtl ? 'row-reverse' : 'row',
            paddingHorizontal: 8,
            gap: 8,
            borderTopWidth: 0.5,
            borderColor: colors.border,
          }}>
          <FigmaButton name="photo" label={t.camera} onPress={() => setCamera(true)} />
          <FigmaButton name="gallery" label={t.photo} onPress={() => void media.choose()} />
          {!imagesOnly ? (
            <FigmaButton name="audio" label={t.recording} onPress={() => void media.startVoice()} />
          ) : null}
        </View>
      ) : null}
      {emoji ? (
        <View
          style={{
            flexDirection: rtl ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 12,
          }}>
          {['😀', '😂', '❤️', '👍', '🙏', '🔥', '👋', '😮', '😢', '🎉', '💯', '🤲'].map(value => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={value}
              key={value}
              onPress={() => {
                setBody(text => text + value);
                setEmoji(false);
                input.current?.focus();
              }}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 25 }}>{value}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View
        style={{
          minHeight: 52,
          paddingHorizontal: 8,
          paddingVertical: 4,
          gap: 4,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
        }}>
        {submitMedia ? (
          <FigmaButton
            name="actions"
            label={t.tools}
            disabled={sending || media.recording}
            onPress={() => setTools(value => !value)}
          />
        ) : null}
        <View
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: colors.surface,
            borderRadius: 18,
            minHeight: 44,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'flex-end',
          }}>
          <View
            aria-hidden
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              top: 0,
              left: rtl ? 56 : 12,
              right: rtl ? 12 : 56,
              opacity: 0,
            }}>
            <Text
              onLayout={event =>
                setInputHeight(
                  Math.max(44, Math.min(120, Math.ceil(event.nativeEvent.layout.height) + 22)),
                )
              }
              style={{ fontSize: 15, lineHeight: 21, writingDirection: direction }}>
              {`${body}\u200b`}
            </Text>
          </View>
          <TextInput
            ref={input}
            multiline
            maxLength={8000}
            value={body}
            onChangeText={setBody}
            placeholder={t.message}
            accessibilityLabel={t.message}
            placeholderTextColor={colors.secondary}
            selectionColor={colors.primary}
            cursorColor={colors.primary}
            underlineColorAndroid="transparent"
            editable={!sending}
            style={[
              {
                flex: 1,
                minWidth: 0,
                height: inputHeight,
                minHeight: 44,
                maxHeight: 120,
                paddingHorizontal: 12,
                paddingVertical: 11,
                fontSize: 15,
                lineHeight: 21,
                color: colors.text,
                writingDirection: direction,
                direction,
                textAlign: direction === 'rtl' ? 'right' : 'left',
                textAlignVertical: 'top',
              },
              browserInputStyle,
            ]}
          />
          <FigmaButton name="emoji" label={t.emoji} onPress={() => setEmoji(value => !value)} />
        </View>
        {body.trim() || media.attachment ? (
          <IconButton
            name="send"
            label={t.send}
            color={colors.primary}
            disabled={full || media.recording}
            busy={sending}
            onPress={() => void send()}
          />
        ) : (
          <FigmaButton
            name="like"
            label={t.sendLike}
            disabled={full || sending || media.recording}
            onPress={() => void send()}
          />
        )}
      </View>
      <CameraCapture
        open={camera}
        close={() => setCamera(false)}
        captured={media.change}
        gallery={() => void media.choose()}
      />
    </View>
  );
}
