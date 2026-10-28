import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useMutation } from 'convex/react';
import { Text, TextInput } from './typography';
import { useAuthActions } from '@convex-dev/auth/react';
import { tailwind } from '../theme';
import { useColors } from './ui';
import { useLocale } from './locale';
import { authRequest, authErrorReason, type AuthFlow } from './auth-request';
import { dziriApi } from './api';
import { IconButton } from './icons';
import { PasswordInput } from './password-input';

export function SignUpCompletion({
  complete,
  cancel,
}: {
  complete: () => void;
  cancel: () => Promise<void>;
}) {
  const acceptTerms = useMutation(dziriApi.acceptTerms);
  const { t } = useLocale();
  const colors = useColors();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void acceptTerms({ source: 'signup' })
      .then(() => {
        if (active) complete();
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [acceptTerms, complete, attempt]);
  return (
    <View style={tailwind.style('flex-1 items-center justify-center gap-4 px-6')}>
      {failed ? (
        <>
          <Text accessibilityRole="alert" style={{ color: colors.text }}>
            {t.authGenericError}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAttempt(v => v + 1)}
            style={tailwind.style('p-3')}>
            <Text style={{ color: colors.primary }}>{t.retry}</Text>
          </Pressable>
          <IconButton
            name="logout"
            label={t.signOut}
            color={colors.text}
            onPress={() => {
              setFailed(false);
              void cancel().catch(() => setFailed(true));
            }}
          />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.text }}>{t.finishSignup}</Text>
        </>
      )}
    </View>
  );
}

export function SignInScreen({
  registrationPending,
}: {
  registrationPending: (value: boolean) => void;
}) {
  const { signIn } = useAuthActions();
  const { t, rtl } = useLocale();
  const colors = useColors();
  const [flow, setFlow] = useState<AuthFlow>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const signup = flow === 'signUp',
    verify = flow === 'reset-verification';
  const recovery = flow === 'reset' || verify;
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(v => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  function changeFlow(next: AuthFlow) {
    if (submitting.current) return;
    setFlow(next);
    setError('');
    setPassword('');
    setConfirmation('');
    setCode('');
    setAgreed(false);
  }
  const submit = async (requestedFlow = flow) => {
    if (submitting.current || (requestedFlow === 'reset' && cooldown > 0)) return;
    setError('');
    const errors = {
      email: t.authEmailError,
      name: t.authNameError,
      consent: t.authConsentError,
      length: t.authLengthError,
      mismatch: t.authMismatchError,
      code: t.authCodeError,
      breached: t.authBreachedError,
      unavailable: t.authUnavailableError,
      limit: t.authLimitError,
      generic: requestedFlow === 'signIn' ? t.loginFailed : t.authGenericError,
    };
    try {
      const params = authRequest(requestedFlow, {
        email,
        password,
        confirmation,
        name,
        code,
        agreed,
      });
      submitting.current = true;
      setBusy(true);
      if (requestedFlow === 'signUp') registrationPending(true);
      await signIn('password', params);
      if (requestedFlow === 'reset') {
        setFlow('reset-verification');
        setCooldown(60);
        setCode('');
      }
    } catch (err) {
      if (requestedFlow === 'signUp') registrationPending(false);
      setError(errors[authErrorReason(err)]);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const inputStyle = [
    tailwind.style('border rounded-[13px] px-3 py-3 text-base'),
    {
      color: colors.text,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      textAlign: rtl ? ('right' as const) : ('left' as const),
    },
  ];
  const primary =
    flow === 'signIn' ? t.signIn : signup ? t.signUp : verify ? t.resetPassword : t.sendCode;
  const disabled =
    busy ||
    !email.trim() ||
    (!recovery && !password) ||
    (signup && (!name.trim() || !agreed || !confirmation)) ||
    (verify && (!code || !password || !confirmation)) ||
    (flow === 'reset' && cooldown > 0);
  function link(label: string, action: () => void, key?: string) {
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        disabled={busy}
        onPress={action}
        style={tailwind.style('px-2 py-3')}>
        <Text style={{ color: colors.primary, textAlign: 'center' }}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 24,
        }}>
        <View
          style={[tailwind.style('gap-4'), { width: '100%', maxWidth: 420, alignSelf: 'center' }]}>
          <Text
            accessibilityRole="header"
            style={[
              tailwind.style('text-xl font-inter-medium-24 text-center'),
              { color: colors.text },
            ]}>
            {signup ? t.signUp : recovery ? t.forgotPassword : t.signIn}
          </Text>
          <Text style={[tailwind.style('text-base text-center'), { color: colors.secondary }]}>
            {signup ? t.signupHint : recovery ? t.resetHint : t.loginHint}
          </Text>
          {signup ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t.name}
              accessibilityLabel={t.name}
              autoComplete="name"
              textContentType="name"
              maxLength={120}
              editable={!busy}
              style={inputStyle}
              placeholderTextColor={colors.secondary}
            />
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t.email}
            accessibilityLabel={t.email}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={254}
            editable={!busy && !verify}
            style={inputStyle}
            placeholderTextColor={colors.secondary}
          />
          {verify ? (
            <>
              <Text
                accessibilityRole="text"
                style={{ color: colors.secondary, textAlign: rtl ? 'right' : 'left' }}>
                {t.recoveryNotice}
              </Text>
              <TextInput
                value={code}
                onChangeText={value => setCode(value.replace(/[^0-9]/g, ''))}
                placeholder={t.code}
                accessibilityLabel={t.code}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                editable={!busy}
                style={inputStyle}
                placeholderTextColor={colors.secondary}
              />
            </>
          ) : null}
          {flow !== 'reset' ? (
            <>
              <PasswordInput
                key={flow}
                value={password}
                onChangeText={setPassword}
                placeholder={verify ? t.newPassword : t.password}
                accessibilityLabel={verify ? t.newPassword : t.password}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={flow === 'signIn' ? 'current-password' : 'new-password'}
                textContentType={flow === 'signIn' ? 'password' : 'newPassword'}
                editable={!busy}
                style={inputStyle}
                placeholderTextColor={colors.secondary}
                onSubmitEditing={() => {
                  void submit();
                }}
              />
              {signup || verify ? (
                <>
                  <Text style={{ color: colors.secondary, textAlign: rtl ? 'right' : 'left' }}>
                    {t.authLengthError}
                  </Text>
                  <PasswordInput
                    key={flow}
                    value={confirmation}
                    onChangeText={setConfirmation}
                    placeholder={t.confirmPassword}
                    accessibilityLabel={t.confirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    editable={!busy}
                    style={inputStyle}
                    placeholderTextColor={colors.secondary}
                  />
                </>
              ) : null}
            </>
          ) : null}
          {signup ? (
            <View style={tailwind.style('gap-1')}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={t.agreeTerms}
                accessibilityState={{ checked: agreed, disabled: busy }}
                disabled={busy}
                onPress={() => setAgreed(v => !v)}
                style={{
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  gap: 12,
                  alignItems: 'center',
                  minHeight: 48,
                }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderWidth: 1,
                    borderRadius: 5,
                    borderColor: colors.primary,
                    backgroundColor: agreed ? colors.primary : colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ color: colors.onPrimary }}>{agreed ? '✓' : ''}</Text>
                </View>
                <Text style={{ flex: 1, color: colors.text, textAlign: rtl ? 'right' : 'left' }}>
                  {t.agreeTerms}
                </Text>
              </Pressable>
              <View
                style={{
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}>
                {link(t.terms, () => {
                  void Linking.openURL('https://www.dziri.app/terms').catch(() =>
                    setError(t.authGenericError),
                  );
                })}
                {link(t.privacy, () => {
                  void Linking.openURL('https://www.dziri.app/privacy').catch(() =>
                    setError(t.authGenericError),
                  );
                })}
              </View>
            </View>
          ) : null}
          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: colors.text, textAlign: rtl ? 'right' : 'left' }}>
              {error}
            </Text>
          ) : null}
          <Pressable
            onPress={() => {
              void submit();
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            style={[
              tailwind.style('py-[11px] items-center rounded-[13px]'),
              { backgroundColor: colors.primary, minHeight: 48, paddingHorizontal: 12 },
            ]}>
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text
                style={[
                  tailwind.style('text-base font-medium text-white'),
                  { textAlign: 'center', color: colors.onPrimary },
                ]}>
                {primary}
              </Text>
            )}
          </Pressable>
          {flow === 'signIn' ? (
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}>
              {link(t.forgotPassword, () => changeFlow('reset'))}
              {link(t.signUp, () => changeFlow('signUp'))}
            </View>
          ) : (
            <>
              {verify ? (
                <View
                  style={{
                    flexDirection: rtl ? 'row-reverse' : 'row',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                  }}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || cooldown > 0}
                    onPress={() => {
                      void submit('reset');
                    }}
                    style={tailwind.style('p-3')}>
                    <Text style={{ color: colors.primary }}>
                      {cooldown ? `${t.resendCode} (${cooldown})` : t.resendCode}
                    </Text>
                  </Pressable>
                  {link(t.changeEmail, () => changeFlow('reset'))}
                </View>
              ) : null}
              {link(t.backToLogin, () => changeFlow('signIn'))}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
