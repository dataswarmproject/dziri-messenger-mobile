import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useMutation } from 'convex/react';
import { dziriApi } from './api';
import { useColors } from './ui';
import { useLocale } from './locale';
import { Text } from './typography';
import { IconButton } from './icons';
export function ThreadActions({
  threadId,
  pinned,
  archived,
  unread,
  close,
  details,
}: {
  threadId: string;
  pinned: boolean;
  archived: boolean;
  unread: boolean;
  close: () => void;
  details: () => void;
}) {
  const update = useMutation(dziriApi.organizeThread),
    colors = useColors(),
    { t, rtl } = useLocale();
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const lock = useRef(false);
  async function run(action: 'archive' | 'pin' | 'unread', value: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await update({ threadId, action, value });
      close();
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const item = (label: string, action: () => void) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={action}
      style={{ minHeight: 52, justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
      <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) close();
      }}>
      <View
        accessibilityViewIsModal
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.close}
          disabled={busy}
          onPress={close}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            padding: 24,
            borderRadius: 32,
            backgroundColor: colors.actionSurface,
          }}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
            <Text accessibilityRole="header" style={{ flex: 1, fontSize: 24, color: colors.text }}>
              {t.more}
            </Text>
            <IconButton
              name="close"
              label={t.close}
              disabled={busy}
              color={colors.text}
              onPress={close}
            />
          </View>
          {item(pinned ? t.unpinChat : t.pinChat, () => void run('pin', !pinned))}
          {item(archived ? t.unarchiveChat : t.archiveChat, () => void run('archive', !archived))}
          {item(unread ? t.markRead : t.markUnread, () => void run('unread', !unread))}
          {item(t.details, () => {
            close();
            details();
          })}
          {busy ? <ActivityIndicator color={colors.secondary} /> : null}
          {failed ? (
            <Text accessibilityRole="alert" style={{ paddingVertical: 12, color: colors.text }}>
              {t.actionFailed}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
