import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dziriApi } from './api';
import type { MessengerRoutes } from './routes';
import { Text } from './typography';
import { ScreenHeading, PersonAvatar } from './screen-parts';
import { useColors } from './ui';
import { useLocale } from './locale';
export function SafetyAction({
  userId,
  name,
  knownBlocked,
}: {
  userId: string;
  name: string;
  knownBlocked?: boolean;
}) {
  const state = useQuery(
    dziriApi.blockState,
    knownBlocked === undefined ? { otherUserId: userId } : 'skip',
  );
  const blocked = knownBlocked ?? state?.blocked;
  const block = useMutation(dziriApi.blockUser),
    unblock = useMutation(dziriApi.unblockUser);
  const { t, rtl } = useLocale(),
    colors = useColors();
  const [intent, setIntent] = useState<'block' | 'unblock' | null>(null),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const lock = useRef(false);
  async function confirm() {
    if (!intent || lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      if (intent === 'block') await block({ blockedUserId: userId });
      else await unblock({ blockedUserId: userId });
      setIntent(null);
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const button = (text: string, action: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={action}
      style={{ minHeight: 44, justifyContent: 'center', opacity: busy || disabled ? 0.5 : 1 }}>
      <Text style={{ color: colors.primary, fontSize: 14 }}>{text}</Text>
    </Pressable>
  );
  return (
    <>
      {button(
        blocked ? t.unblockAccount : t.blockAccount,
        () => {
          setIntent(blocked ? 'unblock' : 'block');
          setFailed(false);
        },
        blocked === undefined,
      )}
      {intent ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!busy) setIntent(null);
          }}>
          <View
            accessibilityViewIsModal
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: 24,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}>
            <View
              style={{
                maxWidth: 420,
                width: '100%',
                alignSelf: 'center',
                padding: 24,
                borderRadius: 24,
                backgroundColor: colors.actionSurface,
              }}>
              <Text accessibilityRole="header" style={{ fontSize: 18, color: colors.text }}>
                {intent === 'block' ? t.blockAccount : t.unblockAccount}
              </Text>
              <Text style={{ fontSize: 15, color: colors.text, paddingVertical: 12 }}>{name}</Text>
              <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 19 }}>
                {intent === 'block' ? t.blockDescription : t.unblockDescription}
              </Text>
              {failed ? (
                <Text accessibilityRole="alert" style={{ paddingVertical: 12, color: colors.text }}>
                  {t.actionFailed}
                </Text>
              ) : null}
              {busy ? <ActivityIndicator color={colors.secondary} /> : null}
              <View
                style={{
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  justifyContent: 'flex-end',
                  gap: 24,
                }}>
                {button(t.cancel, () => setIntent(null))}
                {button(t.confirm, () => void confirm())}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
export function BlockedPeopleScreen({
  navigation,
}: NativeStackScreenProps<MessengerRoutes, 'BlockedPeople'>) {
  const page = usePaginatedQuery(dziriApi.blockedPage, {}, { initialNumItems: 30 });
  const colors = useColors(),
    { t, rtl } = useLocale();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}>
      <ScreenHeading title={t.blockedAccounts} back={() => navigation.goBack()} />
      {page.status === 'LoadingFirstPage' ? <ActivityIndicator color={colors.secondary} /> : null}
      {page.results.map(person => (
        <View
          key={person.userId}
          style={{
            paddingHorizontal: 16,
            minHeight: 72,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <PersonAvatar name={person.name || t.unavailable} image={person.image} size={40} />
          <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>
            {person.name || t.unavailable}
          </Text>
          <SafetyAction userId={person.userId} name={person.name || t.unavailable} knownBlocked />
        </View>
      ))}
      {!page.results.length && page.status === 'Exhausted' ? (
        <Text style={{ padding: 24, color: colors.secondary }}>{t.noBlockedAccounts}</Text>
      ) : null}
      {page.status === 'CanLoadMore' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => page.loadMore(30)}
          style={{ minHeight: 44, padding: 16 }}>
          <Text style={{ color: colors.primary }}>{t.loadMore}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
