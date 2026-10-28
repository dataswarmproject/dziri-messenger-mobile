import { messengerMetrics as metrics } from './colors';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View, type TextInput as NativeInput } from 'react-native';
import { Text, TextInput } from './typography';
import { graphemeSegments } from 'unicode-segmenter/grapheme';
import { insertExpression } from './expression-contract.generated';
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
import { ExpressionPicker } from './expression-picker';
import type { StickerSelection } from './outbox';
import { useLocalDraft } from './local-messages';
import {
  queuedMessageCopy,
  reviewedDraftText,
  type QueuedMessageReview as Review,
} from './message-writes.generated';
import { QueuedMessageReview } from './queued-message-review';
export function MessageComposer({
  textOnly = false,
  reply,
  cancelReply,
  submit,
  submitMedia,
  full = false,
  unavailable = false,
  imagesOnly = false,
  draftScope,
  onActivity,
  review,
  closeReview,
  removeLocal,
}: {
  textOnly?: boolean;
  reply: ReplyPreview | null;
  cancelReply: (submitted?: ReplyPreview | null) => void;
  submit: (body: string, reply?: ReplyPreview) => boolean;
  submitMedia?: (media: UploadedMedia, text: string, reply?: ReplyPreview) => boolean;
  submitSticker?: (sticker: StickerSelection, reply?: ReplyPreview) => boolean;
  full?: boolean;
  unavailable?: boolean;
  imagesOnly?: boolean;
  draftScope?: string;
  onActivity?: (body: string) => void;
  review?: Review | null;
  closeReview?: () => void;
  removeLocal?: (id: string) => Promise<boolean>;
}) {
  const {
    body,
    setBody,
    ready,
    failed: localFailed,
    revision,
    clearSent,
    isCurrent,
  } = useLocalDraft(draftScope);
  const [tools, setTools] = useState(false),
    [emoji, setEmoji] = useState(false),
    [camera, setCamera] = useState(false),
    [sending, setSending] = useState(false),
    [inputHeight, setInputHeight] = useState(metrics.composerMin);
  const input = useRef<NativeInput>(null),
    restoreFocus = useRef(false),
    lock = useRef(false);
  const selection = useRef({ start: 0, end: 0 });
  const [caret, setCaret] = useState<{ start: number; end: number } | undefined>();
  const { rtl, t, locale } = useLocale();
  const colors = useColors();
  const direction = messageDirection(body, rtl);
  const mounted = useRef(true);
  const liveFull = useRef(full || unavailable);
  liveFull.current = full || unavailable;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const media = useAttachment(imagesOnly);
  const reviewLive = useRef(review);
  reviewLive.current = review;
  const [copiedReview, setCopiedReview] = useState<string | null>(null),
    [reviewError, setReviewError] = useState<string | null>(null);
  useEffect(() => {
    setCopiedReview(null);
    setReviewError(null);
  }, [review?.id]);
  function copyReview() {
    const copy = queuedMessageCopy[locale];
    if (
      !review ||
      !mounted.current ||
      reviewLive.current !== review ||
      !isCurrent(body, revision)
    ) {
      setReviewError(copy.changed);
      return;
    }
    const next = reviewedDraftText(review.body, body);
    if (next === null) {
      setReviewError(copy.tooLong);
      return;
    }
    setBody(next);
    setCopiedReview(review.id);
    setReviewError(null);
  }
  async function removeReviewedCopy() {
    if (!review || !mounted.current || reviewLive.current !== review || !removeLocal) return false;
    return removeLocal(review.id);
  }
  useEffect(() => {
    if (reply) {
      restoreFocus.current = true;
      setEmoji(false);
    }
  }, [reply]);
  useEffect(() => {
    if (!emoji && restoreFocus.current) {
      restoreFocus.current = false;
      input.current?.focus();
    }
  }, [emoji, reply]);
  async function send() {
    if (lock.current || full || unavailable || !ready) return;
    lock.current = true;
    setSending(true);
    try {
      const attachment = media.attachment;
      const uploaded = attachment && submitMedia ? await media.upload() : undefined;
      if (!mounted.current || liveFull.current) return;
      const accepted =
        uploaded && submitMedia && attachment
          ? submitMedia(
              uploaded,
              body.trim() ? body : attachment.type === 'file' ? attachment.name || '' : body,
              reply ?? undefined,
            )
          : submit(body.trim() ? body : '👍', reply ?? undefined);
      if (accepted) {
        media.retainPreview?.();
        if (clearSent(body, revision)) onActivity?.('');
        media.change(null);
        cancelReply(reply);
        setTools(false);
      }
    } catch {
    } finally {
      if (mounted.current) setSending(false);
      lock.current = false;
    }
  }
  return (
    <View style={{ backgroundColor: colors.background, direction: 'ltr' }}>
      {review ? (
        <QueuedMessageReview
          message={review}
          occupied={Boolean(body)}
          copied={copiedReview === review.id}
          error={reviewError}
          onUse={copyReview}
          onClose={() => closeReview?.()}
          onRemove={removeLocal ? removeReviewedCopy : undefined}
        />
      ) : null}
      {localFailed ? (
        <Text accessibilityRole="alert" style={{ padding: 8, fontSize: 13, color: colors.text }}>
          {t.localSaveFailed}
        </Text>
      ) : null}
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
            onPress={() => cancelReply()}
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
            label={media.busy ? t.cancelUpload : t.cancel}
            color={colors.secondary}
            disabled={sending && !media.busy}
            onPress={() => (media.busy ? media.cancelUpload() : media.change(null))}
          />
        </View>
      ) : null}
      {media.busy ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t.uploading}
          accessibilityValue={{ min: 0, max: 100, now: Math.floor(media.progress * 100) }}
          style={{ paddingHorizontal: 16, gap: 6 }}>
          <Text style={{ fontSize: 12, color: colors.secondary }}>
            {t.uploading} · {Math.floor(media.progress * 100)}%
          </Text>
          <View style={{ height: 3, backgroundColor: colors.surface, borderRadius: 2 }}>
            <View
              style={{
                height: 3,
                width: `${media.progress * 100}%`,
                backgroundColor: colors.primary,
                borderRadius: 2,
              }}
            />
          </View>
        </View>
      ) : null}
      {media.recording || media.requesting ? (
        <View
          style={{
            padding: 12,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <Text accessibilityRole="alert" style={{ color: colors.text, flex: 1 }}>
            {media.requesting
              ? t.microphonePending
              : `${t.recording} · ${Math.floor(media.seconds / 60)}:${String(media.seconds % 60).padStart(2, '0')}`}
          </Text>
          <IconButton
            name="trash"
            label={t.discardRecording}
            color={colors.primary}
            onPress={() => void media.cancelVoice()}
          />
          <Pressable
            accessibilityRole="button"
            disabled={media.requesting}
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
            <IconButton
              name="file"
              label={t.file}
              color={colors.primary}
              disabled={sending || media.recording}
              onPress={() => void media.chooseDocument()}
            />
          ) : null}
          {!imagesOnly ? (
            <FigmaButton name="audio" label={t.recording} onPress={() => void media.startVoice()} />
          ) : null}
        </View>
      ) : null}
      {emoji ? (
        <ExpressionPicker
          close={() => {
            restoreFocus.current = true;
            setEmoji(false);
          }}
          disabled={full || unavailable || sending}
          selectEmoji={value => {
            const result = insertExpression(
              body,
              selection.current.start,
              selection.current.end,
              value,
              8000,
              graphemeSegments(body),
            );
            if (!result) return;
            setBody(result.value);
            selection.current = { start: result.caret, end: result.caret };
            setCaret(selection.current);
            restoreFocus.current = true;
            setEmoji(false);
          }}
        />
      ) : null}
      {!emoji ? (
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
            <IconButton
              name="addCircle"
              color={colors.primary}
              compact
              label={t.tools}
              disabled={sending || media.recording}
              onPress={() => setTools(value => !value)}
            />
          ) : null}
          {submitMedia && !body.trim() && !media.attachment && !tools ? (
            <>
              <FigmaButton
                compact
                name="photo"
                label={t.camera}
                disabled={sending || media.recording}
                onPress={() => setCamera(true)}
              />
              <FigmaButton
                compact
                name="gallery"
                label={t.photo}
                disabled={sending || media.recording}
                onPress={() => void media.choose()}
              />
              {!imagesOnly ? (
                <FigmaButton
                  compact
                  name="audio"
                  label={t.recording}
                  disabled={sending || media.recording}
                  onPress={() => void media.startVoice()}
                />
              ) : null}
            </>
          ) : null}
          <View
            style={{
              flex: 1,
              minWidth: 0,
              backgroundColor: colors.surface,
              borderRadius: 18,
              minHeight: metrics.composerMin,
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
                    Math.max(
                      metrics.composerMin,
                      Math.min(
                        metrics.composerMax,
                        Math.ceil(event.nativeEvent.layout.height) + 22,
                      ),
                    ),
                  )
                }
                style={{
                  fontSize: metrics.message,
                  lineHeight: metrics.messageLine,
                  writingDirection: direction,
                }}>
                {`${body}\u200b`}
              </Text>
            </View>
            <TextInput
              ref={input}
              multiline
              maxLength={textOnly ? 2000 : 8000}
              value={body}
              onChangeText={value => {
                onActivity?.(value);
                setBody(value);
                setCaret(undefined);
              }}
              selection={caret}
              onSelectionChange={event => {
                selection.current = event.nativeEvent.selection;
              }}
              placeholder={t.message}
              accessibilityLabel={t.message}
              placeholderTextColor={colors.secondary}
              selectionColor={colors.selection}
              cursorColor={colors.primary}
              underlineColorAndroid="transparent"
              editable={!sending && ready}
              style={[
                {
                  flex: 1,
                  minWidth: 0,
                  height: inputHeight,
                  minHeight: metrics.composerMin,
                  maxHeight: metrics.composerMax,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                  fontSize: metrics.message,
                  lineHeight: metrics.messageLine,
                  color: colors.text,
                  writingDirection: direction,
                  direction,
                  textAlign: direction === 'rtl' ? 'right' : 'left',
                  textAlignVertical: 'top',
                },
              ]}
            />
            <FigmaButton
              compact
              name="emoji"
              label={t.emoji}
              disabled={sending}
              onPress={() => setEmoji(value => !value)}
            />
          </View>
          {body.trim() || media.attachment ? (
            <IconButton
              name="send"
              compact
              label={t.send}
              color={colors.primary}
              disabled={full || unavailable || media.recording || media.requesting}
              busy={sending}
              onPress={() => void send()}
            />
          ) : (
            <FigmaButton
              name="like"
              compact
              label={t.sendLike}
              disabled={full || unavailable || sending || media.recording}
              onPress={() => void send()}
            />
          )}
        </View>
      ) : null}
      <CameraCapture
        open={camera}
        close={() => setCamera(false)}
        captured={media.change}
        gallery={() => void media.choose()}
      />
    </View>
  );
}
