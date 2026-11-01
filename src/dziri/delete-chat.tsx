import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useMutation } from 'convex/react';
import { dziriApi } from './api';
import { useLocale } from './locale';
import { useColors } from './ui';
import { Text } from './typography';
import { inboxActionCopy } from './inbox-actions.generated';
export type DeleteChatIntent = {
  threadId: string;
  expectedActorId: string;
  throughRevision: number;
};
export function DeleteChat({
  intent,
  current,
  close,
}: {
  intent: DeleteChatIntent;
  current: boolean;
  close: () => void;
}) {
  const remove = useMutation(dziriApi.deleteHistory);
  const { locale } = useLocale(),
    colors = useColors(),
    copy = inboxActionCopy[locale];
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const lock = useRef(false);
  async function confirm() {
    if (lock.current || !current) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await remove(intent);
      close();
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
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
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}>
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            padding: 24,
            borderRadius: 24,
            gap: 16,
            backgroundColor: colors.actionSurface,
          }}>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 20, fontWeight: '600', color: colors.text }}>
            {copy.deleteTitle}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: colors.secondary }}>
            {copy.deleteDescription}
          </Text>
          {!current || failed ? (
            <Text accessibilityRole="alert" style={{ color: colors.text }}>
              {failed ? copy.failed : copy.unavailable}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy || !current}
            onPress={() => void confirm()}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              opacity: busy || !current ? 0.5 : 1,
            }}>
            {busy ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={{ fontWeight: '600', color: colors.text }}>{copy.delete}</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={close}
            style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.text }}>{copy.cancel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
