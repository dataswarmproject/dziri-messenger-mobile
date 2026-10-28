import { ReportPanel } from './request-report';
import type { ReportTarget } from './messenger-safety.generated';
import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Text, TextInput } from './typography';
import { Icon, type IconName } from './icons';
import { useLocale } from './locale';
import { useColors } from './ui';
import { messageDirection } from './typeface';
import { ExpressionPicker } from './expression-picker';
import {
  editedMessageText,
  messageActionAvailability,
  MESSAGE_TEXT_LIMIT,
  MESSAGE_QUICK_REACTIONS,
} from './message-action-policy.generated';
import type { BubbleMessage } from './message-bubble';

export function MessageActionDialog({
  message,
  myId,
  writable,
  edit,
  remove,
  close,
  reply,
  react,
  anchorY,
  onCopied,
  pin,
  renderForward,
  reportTarget,
}: {
  message: BubbleMessage;
  reportTarget?: ReportTarget;
  myId: string;
  writable: boolean;
  edit?: (message: BubbleMessage, body: string) => Promise<unknown>;
  remove?: (message: BubbleMessage) => Promise<unknown>;
  reply?: () => void;
  react?: (emoji: string) => Promise<unknown>;
  close: () => void;
  anchorY?: number;
  onCopied?: () => void;
  pin?: () => Promise<unknown>;
  renderForward?: (complete: () => void, back: () => void) => ReactNode;
}) {
  const { t, rtl, locale } = useLocale(),
    colors = useColors(),
    insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [mode, setMode] = useState<
    'context' | 'more' | 'emoji' | 'edit' | 'delete' | 'forward' | 'report'
  >('context');
  const [draft, setDraft] = useState(message.actionBody ?? '');
  useEffect(() => {
    if (
      (mode === 'forward' && !renderForward) ||
      (!writable && ['edit', 'delete', 'forward'].includes(mode))
    )
      setMode('context');
  }, [mode, renderForward, writable]);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const locked = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    Keyboard.dismiss();
    return () => {
      mounted.current = false;
    };
  }, []);
  const safetyCopyLabel = () =>
    locale === 'ar'
      ? 'الإبلاغ عن الرسالة'
      : locale === 'fr'
        ? 'Signaler le message'
        : 'Report message';
  const target = {
    mine: message.senderId === myId,
    type: message.type ?? 'unsupported',
    body: message.actionBody,
    createdAt: message.createdAt,
    deleted: message.deleted,
    local: message.local,
    immutable: message.immutable,
    writable,
  };
  const available = messageActionAvailability(target);
  const canInteract = writable && !message.local && !message.deleted;
  const dismiss = () => {
    if (!locked.current) close();
  };
  async function run(action: () => Promise<unknown>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      if (mounted.current) close();
    } catch {
      if (mounted.current) setError(t.actionFailed);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function save() {
    if (locked.current) return;
    if (!messageActionAvailability(target).edit || !edit) {
      setError(t.editExpired);
      return;
    }
    const text = editedMessageText(draft, message.actionBody);
    if (text !== null) void run(() => edit(message, text));
  }
  const tool = (name: IconName, label: string, action: () => void, accessibilityLabel = label) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={busy}
      onPress={action}
      style={{
        flex: 1,
        minHeight: 64,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: busy ? 0.5 : 1,
      }}>
      <Icon name={name} size={24} color={colors.text} />
      <Text style={{ color: colors.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
  const contextual = mode === 'context' || mode === 'emoji';
  const surface = colors.actionSurface;
  const railY = Math.max(
    insets.top + 56,
    Math.min((anchorY ?? height - 200) - 64, height - insets.bottom - 190),
  );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <KeyboardAvoidingView
        accessibilityViewIsModal
        onAccessibilityEscape={dismiss}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: mode === 'more' ? 26 : 16,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: contextual ? 'transparent' : 'rgba(0,0,0,0.55)',
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.close}
          accessible={contextual || mode === 'more'}
          onPress={dismiss}
          disabled={busy}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        />
        {mode === 'context' ? (
          <>
            {react && canInteract ? (
              <View
                style={{
                  position: 'absolute',
                  top: railY,
                  width: Math.min(width - 24, 324),
                  backgroundColor: colors.surface,
                  borderRadius: 36,
                  padding: 8,
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  alignItems: 'center',
                }}>
                {MESSAGE_QUICK_REACTIONS.map(emoji => (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.react} ${emoji}`}
                    accessibilityState={{
                      selected: message.reactions.some(r => r.emoji === emoji && r.mine),
                      disabled: busy,
                    }}
                    disabled={busy}
                    onPress={() => void run(() => react(emoji))}
                    style={{
                      flex: 1,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 22,
                      backgroundColor: message.reactions.some(r => r.emoji === emoji && r.mine)
                        ? colors.selection
                        : 'transparent',
                    }}>
                    <Text style={{ fontSize: 30 }}>{emoji}</Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.moreEmojis}
                  disabled={busy}
                  onPress={() => setMode('emoji')}
                  style={{
                    flex: 1,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 22,
                    backgroundColor: colors.selection,
                  }}>
                  <Text style={{ fontSize: 28, color: colors.text }}>+</Text>
                </Pressable>
              </View>
            ) : null}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                minHeight: 104,
                paddingHorizontal: 12,
                paddingTop: 12,
                paddingBottom: insets.bottom + 16,
                backgroundColor: surface,
              }}>
              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.text, fontSize: 13, padding: 8 }}>
                  {error}
                </Text>
              ) : null}
              {busy ? <ActivityIndicator color={colors.secondary} size="small" /> : null}
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row' }}>
                {reply && canInteract
                  ? tool('reply', t.reply, () => {
                      reply();
                      close();
                    })
                  : null}
                {available.copy
                  ? tool(
                      'copy',
                      t.copy,
                      () =>
                        void run(async () => {
                          if (!(await Clipboard.setStringAsync(message.actionBody!)))
                            throw new Error('Clipboard unavailable');
                          onCopied?.();
                        }),
                      t.copyText,
                    )
                  : null}
                {available.remove && remove
                  ? tool(
                      'trash',
                      t.delete,
                      () => {
                        setError('');
                        setMode('delete');
                      },
                      t.deleteMessage,
                    )
                  : null}
                {(available.edit && edit) || pin || renderForward || reportTarget
                  ? tool('menu', t.more, () => {
                      setError('');
                      setMode('more');
                    })
                  : null}
              </View>
            </View>
          </>
        ) : mode === 'report' && reportTarget ? (
          <ReportPanel target={reportTarget} close={close} />
        ) : mode === 'forward' ? (
          (renderForward?.(close, () => setMode('more')) ?? null)
        ) : mode === 'emoji' ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: height * 0.6,
              backgroundColor: surface,
            }}>
            <ExpressionPicker
              close={() => setMode('context')}
              disabled={busy}
              selectEmoji={emoji => {
                if (react && canInteract) void run(() => react(emoji));
              }}
            />
            {error ? (
              <Text accessibilityRole="alert" style={{ color: colors.text, padding: 12 }}>
                {error}
              </Text>
            ) : null}
          </View>
        ) : (
          <View
            onAccessibilityEscape={dismiss}
            style={{
              width: '100%',
              maxWidth: 420,
              borderRadius: mode === 'more' ? 32 : 20,
              padding: 24,
              backgroundColor: surface,
              direction: 'ltr',
            }}>
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: colors.text,
                  fontSize: mode === 'more' ? 24 : 17,
                  fontWeight: mode === 'more' ? '400' : '600',
                  flex: 1,
                }}>
                {mode === 'more' ? t.more : mode === 'edit' ? t.editMessage : t.deleteMessageTitle}
              </Text>
              {busy ? <ActivityIndicator color={colors.secondary} size="small" /> : null}
              {mode !== 'more' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.close}
                  disabled={busy}
                  onPress={dismiss}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" color={colors.secondary} />
                </Pressable>
              ) : null}
            </View>
            {mode === 'more' ? (
              <>
                {reportTarget ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => setMode('report')}
                    style={{ minHeight: 50, justifyContent: 'center' }}>
                    <Text style={{ color: colors.text, fontSize: 17 }}>{safetyCopyLabel()}</Text>
                  </Pressable>
                ) : null}
                {available.edit && edit ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.editMessage}
                    disabled={busy || !available.edit}
                    onPress={() => {
                      setDraft(message.actionBody ?? '');
                      setError('');
                      setMode('edit');
                    }}
                    style={{ minHeight: 50, justifyContent: 'center' }}>
                    <Text style={{ color: colors.text, fontSize: 17 }}>{t.edit}</Text>
                  </Pressable>
                ) : null}
                {pin ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void run(pin)}
                    style={{ minHeight: 50, justifyContent: 'center' }}>
                    <Text style={{ color: colors.text, fontSize: 17 }}>
                      {message.pinned ? t.unpinMessage : t.pinMessage}
                    </Text>
                  </Pressable>
                ) : null}
                {renderForward ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => setMode('forward')}
                    style={{ minHeight: 50, justifyContent: 'center' }}>
                    <Text style={{ color: colors.text, fontSize: 17 }}>{t.forwardMessage}</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                {mode === 'edit' ? (
                  <TextInput
                    multiline
                    autoFocus
                    accessibilityLabel={t.editMessage}
                    value={draft}
                    onChangeText={setDraft}
                    editable={!busy}
                    maxLength={MESSAGE_TEXT_LIMIT}
                    style={{
                      minHeight: 96,
                      maxHeight: 180,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: colors.surface,
                      color: colors.text,
                      fontSize: 15,
                      lineHeight: 21,
                      textAlignVertical: 'top',
                      writingDirection: messageDirection(draft, rtl),
                      textAlign: messageDirection(draft, rtl) === 'rtl' ? 'right' : 'left',
                    }}
                  />
                ) : (
                  <Text style={{ color: colors.secondary, fontSize: 14, lineHeight: 21 }}>
                    {t.deleteMessageDescription}
                  </Text>
                )}
                <View
                  style={{
                    flexDirection: rtl ? 'row-reverse' : 'row',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 16,
                  }}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={dismiss}
                    style={{
                      minHeight: 44,
                      minWidth: 80,
                      padding: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ color: colors.text, fontSize: 14 }}>{t.cancel}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      busy ||
                      (mode === 'edit' && editedMessageText(draft, message.actionBody) === null)
                    }
                    onPress={() => {
                      if (mode === 'edit') save();
                      else if (messageActionAvailability(target).remove && remove)
                        void run(() => remove(message));
                    }}
                    style={{
                      minHeight: 44,
                      minWidth: 80,
                      borderRadius: 12,
                      padding: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.primary,
                      opacity:
                        busy ||
                        (mode === 'edit' && editedMessageText(draft, message.actionBody) === null)
                          ? 0.5
                          : 1,
                    }}>
                    <Text style={{ color: colors.onPrimary, fontSize: 14, fontWeight: '600' }}>
                      {mode === 'edit' ? t.save : t.delete}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
            {error ? (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 12 }}>
                {error}
              </Text>
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
