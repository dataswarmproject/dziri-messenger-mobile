import React, { useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useConvex } from 'convex/react';
import { Text, TextInput } from '../dziri/typography';
import { useLocale } from '../dziri/locale';
import { colorsFor } from '../dziri/theme';
import {
  staffHandoffCopy,
  staffHandoffMessage,
  type StaffWorkspace,
} from '../dziri/messenger-staff.generated';
import { useStaffHandoff } from './use-staff-handoff';
import type { StaffReservation } from './use-staff-session';

const colors = colorsFor(true);
const styles = StyleSheet.create({
  group: { gap: 12 },
  text: { color: colors.secondary, fontSize: 13 },
  button: {
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.text, fontSize: 14 },
  input: {
    minHeight: 48,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
});
export function StaffHandoffGate({
  workspace,
  reserve,
  sessionBusy,
  children,
}: {
  workspace: StaffWorkspace;
  reserve: () => StaffReservation | null;
  sessionBusy: boolean;
  children: (blocked: boolean, panel: React.ReactNode) => React.ReactNode;
}) {
  const convex = useConvex(),
    { locale } = useLocale(),
    copy = staffHandoffCopy(locale);
  const flow = useStaffHandoff(workspace, convex, reserve);
  const [code, setCode] = useState(''),
    [recovery, setRecovery] = useState(false);
  const challenge = ['mfa_required', 'challenge_failed', 'invalid_attempt'].includes(flow.state);
  const button = (label: string, action: () => void, disabled = flow.busy) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={action}
      style={[styles.button, { opacity: disabled ? 0.5 : 1 }]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
  const submit = () => {
    const value = code.trim();
    setCode('');
    void flow.verify(recovery ? { backupCode: value } : { otpCode: value });
  };
  return children(
    flow.blocked,
    <View style={styles.group}>
      <Text accessibilityLiveRegion="polite" style={styles.text}>
        {flow.busy ? copy.working : staffHandoffMessage(flow.state, locale)}
      </Text>
      {challenge ? (
        <>
          <Text style={styles.label}>{recovery ? copy.recoveryCode : copy.code}</Text>
          <TextInput
            accessibilityLabel={recovery ? copy.recoveryCode : copy.code}
            value={code}
            onChangeText={setCode}
            secureTextEntry={recovery}
            editable={!flow.busy}
            autoCapitalize={recovery ? 'characters' : 'none'}
            keyboardType={recovery ? 'default' : 'number-pad'}
            autoComplete={recovery ? 'off' : 'one-time-code'}
            autoCorrect={false}
            maxLength={recovery ? 8 : 6}
            style={styles.input}
          />
          {button(
            copy.verify,
            submit,
            flow.busy || !(recovery ? /^[A-F0-9]{8}$/ : /^\d{6}$/).test(code.trim()),
          )}
          {button(recovery ? copy.otp : copy.recovery, () => {
            setCode('');
            setRecovery(!recovery);
          })}
        </>
      ) : (
        button(
          flow.pending ? copy.resume : copy.continue,
          () => {
            setCode('');
            void (flow.pending ? flow.resume() : flow.start());
          },
          flow.busy || (!flow.pending && sessionBusy),
        )
      )}
      {flow.pending || flow.busy
        ? button(
            copy.cancel,
            () => {
              setCode('');
              void flow.cancel();
            },
            false,
          )
        : null}
    </View>,
  );
}
