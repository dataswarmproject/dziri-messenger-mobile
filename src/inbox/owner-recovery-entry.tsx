import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Platform, Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { useConvex } from 'convex/react';
import { useLocale } from '../dziri/locale';
import { useColors } from '../dziri/ui';
import { Text } from '../dziri/typography';
import { FigmaIcon } from '../dziri/figma';
import { SettingsRow } from '../dziri/settings-row';
import { staffRecoveryCopy, staffHandoffMessage } from '../dziri/messenger-staff.generated';
import { createOwnerRecovery, type OwnerRecoveryState } from './owner-recovery';
import type { PendingHandoff } from './handoff';

type Life = {
  active: boolean;
  sequence: number;
  busy: boolean;
  api: ReturnType<typeof createOwnerRecovery>;
};
type ViewState = {
  actorId: string;
  items: PendingHandoff[];
  loading: boolean;
  busy: boolean;
  message: '' | OwnerRecoveryState;
};
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  text: { fontSize: 14, lineHeight: 21 },
  button: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Injected by the signed-in root, independent of current business eligibility. */
export function StaffRecoveryEntry({ actorId }: { actorId: string }) {
  const convex = useConvex(),
    api = useMemo(() => createOwnerRecovery(actorId, convex), [actorId, convex]);
  const { locale, rtl } = useLocale(),
    copy = staffRecoveryCopy(locale),
    colors = useColors();
  const [open, setOpen] = useState(false),
    [confirm, setConfirm] = useState<PendingHandoff | null>(null);
  const [view, setView] = useState<ViewState>({
    actorId,
    items: [],
    loading: true,
    busy: false,
    message: '',
  });
  const life = useRef<Life | null>(null);
  const keepButton = useRef<View>(null),
    closeButton = useRef<View>(null),
    rowButton = useRef<View>(null),
    refreshButton = useRef<View>(null);
  const returnScope = useRef(''),
    restoreFocus = useRef(false);
  useEffect(() => {
    if (!open) return;
    if (confirm) {
      restoreFocus.current = true;
      keepButton.current?.focus();
    } else if (restoreFocus.current) {
      if (view.busy || view.loading) closeButton.current?.focus();
      else {
        (rowButton.current ?? refreshButton.current ?? closeButton.current)?.focus();
        restoreFocus.current = false;
      }
    }
  }, [open, confirm, view.busy, view.loading]);

  async function refresh(current: Life) {
    if (!current.active || current.busy) return;
    const sequence = ++current.sequence;
    setView(v => ({ ...v, loading: true }));
    try {
      const items = await current.api.load();
      if (current.active && sequence === current.sequence)
        setView({ actorId, items, loading: false, busy: false, message: '' });
    } catch {
      if (current.active && sequence === current.sequence)
        setView(v => ({ ...v, loading: false, message: 'storage_failed' }));
    }
  }
  useEffect(() => {
    const current: Life = { active: true, sequence: 0, busy: false, api };
    life.current = current;
    setView({ actorId, items: [], loading: true, busy: false, message: '' });
    setOpen(false);
    setConfirm(null);
    void refresh(current);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh(current);
    });
    return () => {
      current.active = false;
      current.sequence++;
      subscription.remove();
    };
    // A locale change must not reload private state or repeat a cancellation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, api]);

  async function cancel(pending: PendingHandoff) {
    const current = life.current;
    if (!current?.active || current.busy) return;
    current.busy = true;
    const sequence = ++current.sequence;
    setConfirm(null);
    setView(v => ({ ...v, busy: true, loading: false, message: '' }));
    let message: OwnerRecoveryState = 'revocation_unconfirmed';
    let items = view.items;
    try {
      message = (await current.api.cancel(pending)).state;
    } catch {
      /* Retain proof on uncertain cleanup. */
    }
    try {
      items = await current.api.load();
    } catch {
      message = 'storage_failed';
    }
    if (current.active && sequence === current.sequence) {
      current.busy = false;
      setView({ actorId, items, busy: false, loading: false, message });
    }
  }
  if (view.actorId !== actorId || (!open && !view.items.length && !view.message)) return null;
  const button = (
    label: string,
    press: () => void,
    disabled = view.busy || view.loading,
    ref?: React.RefObject<View | null>,
  ) => (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={press}
      disabled={disabled}
      style={[styles.button, { borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[styles.text, { color: colors.text, textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
  const message = view.busy
    ? copy.working
    : view.loading
      ? copy.loading
      : view.message === 'cancelled'
        ? copy.complete
        : view.message
          ? staffHandoffMessage(view.message, locale)
          : '';
  return (
    <>
      {(view.items.length > 0 || view.message) && (
        <SettingsRow
          icon="privacy"
          title={copy.title}
          value={
            view.message && view.message !== 'cancelled' ? copy.review : String(view.items.length)
          }
          onPress={() => {
            setOpen(true);
            setConfirm(null);
            if (life.current) void refresh(life.current);
          }}
        />
      )}
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View
            {...(Platform.OS === 'web' ? { dir: 'ltr' as const } : {})}
            accessibilityViewIsModal
            style={[
              styles.sheet,
              Platform.OS !== 'web' && { direction: 'ltr' },
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}>
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                minHeight: 60,
                alignItems: 'center',
                padding: 12,
                gap: 8,
              }}>
              <Pressable
                ref={closeButton}
                accessibilityRole="button"
                accessibilityLabel={copy.close}
                onPress={() => setOpen(false)}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.5 : 1,
                })}>
                <FigmaIcon name="back" />
              </Pressable>
              <Text
                accessibilityRole="header"
                style={{ flex: 1, fontSize: 18, lineHeight: 24, color: colors.text }}>
                {copy.title}
              </Text>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16 }}>
              <Text style={[styles.text, { color: colors.secondary }]}>
                {confirm ? copy.confirmHint : copy.description}
              </Text>
              {message ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.text, { color: colors.text }]}>
                  {message}
                </Text>
              ) : null}
              {confirm ? (
                <>
                  <Text accessibilityRole="alert" style={[styles.text, { color: colors.text }]}>
                    {copy.confirm}
                  </Text>
                  {button(copy.cancel, () => {
                    void cancel(confirm);
                  })}
                  {button(copy.keep, () => setConfirm(null), view.busy || view.loading, keepButton)}
                </>
              ) : (
                <>
                  {!view.loading && !view.items.length && view.message !== 'storage_failed' && (
                    <Text style={[styles.text, { color: colors.secondary }]}>{copy.empty}</Text>
                  )}
                  {view.items.map((pending, index) => (
                    <View
                      key={pending.scope}
                      style={{
                        gap: 10,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                      }}>
                      <Text style={[styles.text, { color: colors.text }]}>
                        {copy.attempt} {index + 1}
                      </Text>
                      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.secondary }}>
                        {pending.expiresAt <= Date.now()
                          ? copy.expired
                          : `${copy.expires}: ${new Date(pending.expiresAt).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                      </Text>
                      {button(
                        copy.cancel,
                        () => {
                          returnScope.current = pending.scope;
                          setConfirm(pending);
                        },
                        view.busy || view.loading,
                        returnScope.current === pending.scope ? rowButton : undefined,
                      )}
                    </View>
                  ))}
                  {button(
                    copy.reload,
                    () => {
                      if (life.current) void refresh(life.current);
                    },
                    view.busy || view.loading,
                    refreshButton,
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
