import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from './typography';
import { useLocale } from './locale';
import { useColors } from './ui';
import {
  queuedMessageCopy,
  localCopyRemovalCopy,
  type QueuedMessageReview as Review,
} from './message-writes.generated';
export function QueuedMessageReview({
  message,
  occupied,
  copied,
  error,
  onUse,
  onClose,
  onRemove,
}: {
  message: Review;
  occupied: boolean;
  copied: boolean;
  error?: string | null;
  onUse: () => void;
  onClose: () => void;
  onRemove?: () => Promise<boolean>;
}) {
  const { locale, rtl } = useLocale(),
    colors = useColors(),
    copy = queuedMessageCopy[locale];
  const removal = localCopyRemovalCopy[locale],
    live = useRef({ id: message.id, mounted: true }),
    lock = useRef(false);
  live.current.id = message.id;
  const [confirming, setConfirming] = useState(false),
    [removing, setRemoving] = useState(false),
    [removeError, setRemoveError] = useState(false);
  useEffect(() => {
    const lifetime = live.current;
    lifetime.mounted = true;
    return () => {
      lifetime.mounted = false;
    };
  }, []);
  useEffect(() => {
    setConfirming(false);
    setRemoving(false);
    setRemoveError(false);
    lock.current = false;
  }, [message.id]);
  async function removeCopy() {
    const selected = message.id;
    if (!onRemove || lock.current || !live.current.mounted || live.current.id !== selected) return;
    lock.current = true;
    setRemoving(true);
    setRemoveError(false);
    try {
      const done = await onRemove();
      if (!live.current.mounted || live.current.id !== selected) return;
      if (done) onClose();
      else setRemoveError(true);
    } catch {
      if (live.current.mounted && live.current.id === selected) setRemoveError(true);
    } finally {
      if (live.current.mounted && live.current.id === selected) {
        lock.current = false;
        setRemoving(false);
      }
    }
  }
  if (confirming)
    return (
      <View
        style={{ padding: 12, gap: 6, borderBottomWidth: 1, borderColor: colors.secondary }}
        accessibilityLabel={removal.title}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
          {removal.title}
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.secondary }}>
          {removal.description}
        </Text>
        {message.body ? (
          <ScrollView style={{ maxHeight: 80 }} showsVerticalScrollIndicator={false}>
            <Text selectable style={{ fontSize: 13, color: colors.text }}>
              {message.body}
            </Text>
          </ScrollView>
        ) : null}
        {message.attachment ? (
          <Text style={{ fontSize: 12, color: colors.text }}>{message.attachment}</Text>
        ) : null}
        {removeError ? (
          <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: colors.text }}>
            {removal.failed}
          </Text>
        ) : null}
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            disabled={removing}
            accessibilityState={{ disabled: removing }}
            onPress={() => void removeCopy()}
            style={{
              minHeight: 44,
              padding: 10,
              justifyContent: 'center',
              borderWidth: 1,
              borderRadius: 10,
              borderColor: colors.secondary,
            }}>
            <Text style={{ fontSize: 12, color: colors.text }}>
              {removing ? removal.busy : removal.confirm}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={removing}
            accessibilityState={{ disabled: removing }}
            onPress={() => setConfirming(false)}
            style={{ minHeight: 44, padding: 10, justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.text }}>{removal.cancel}</Text>
          </Pressable>
        </View>
      </View>
    );
  return (
    <View
      accessibilityLabel={copy.title}
      style={{ padding: 12, borderBottomWidth: 1, borderColor: colors.secondary, gap: 6 }}>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
        {copy.title}
      </Text>
      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.secondary }}>
        {copy.description}
      </Text>
      {message.body ? (
        <ScrollView style={{ maxHeight: 80 }} showsVerticalScrollIndicator={false}>
          <Text selectable style={{ fontSize: 13, color: colors.text }}>
            {message.body}
          </Text>
        </ScrollView>
      ) : null}
      {message.attachment ? (
        <>
          <Text style={{ fontSize: 12, color: colors.text }}>{message.attachment}</Text>
          <Text style={{ fontSize: 12, lineHeight: 18, color: colors.secondary }}>
            {copy.media}
          </Text>
        </>
      ) : null}
      {copied || error ? (
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: colors.text }}>
          {error || copy.copied}
        </Text>
      ) : null}
      <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
        {message.body ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: copied }}
            disabled={copied}
            onPress={onUse}
            style={{
              minHeight: 44,
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.secondary,
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 12, color: colors.text }}>
              {occupied ? copy.append : copy.use}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={{ minHeight: 44, padding: 10, justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: colors.text }}>{copy.keep}</Text>
        </Pressable>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirming(true)}
            style={{ minHeight: 44, padding: 10, justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.secondary }}>{removal.remove}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
