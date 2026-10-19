import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useAuthActions } from '@convex-dev/auth/react';
import { tailwind } from '../theme';
import { LanguageChoice, useColors } from './ui';
import { useLocale } from './locale';

export function SignInScreen() {
  const { signIn } = useAuthActions();
  const { t, rtl } = useLocale();
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [failed, setFailed] = useState(false);
  const submit = async () => {
    if (submitting.current || !email.trim() || !password) return;
    submitting.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await signIn('password', { email: email.trim(), password, flow: 'signIn' });
    } catch {
      setFailed(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const inputStyle = [
    tailwind.style('border rounded-[13px] px-3 py-3 text-base'),
    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        tailwind.style('flex-1 justify-center px-6'),
        { backgroundColor: colors.background },
      ]}>
      <View style={tailwind.style('gap-4')}>
        <Image
          source={require('../../assets/dziri-ring.png')}
          accessibilityLabel={t.app}
          style={tailwind.style('h-20 w-20 self-center')}
          contentFit="contain"
        />
        <Text
          style={[
            tailwind.style('text-xl font-inter-medium-24 text-center'),
            { color: colors.text },
          ]}>
          {t.app}
        </Text>
        <Text style={[tailwind.style('text-base text-center'), { color: colors.secondary }]}>
          {t.loginHint}
        </Text>
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
          editable={!busy}
          style={inputStyle}
          placeholderTextColor={colors.secondary}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t.password}
          accessibilityLabel={t.password}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          editable={!busy}
          style={inputStyle}
          placeholderTextColor={colors.secondary}
          onSubmitEditing={() => {
            void submit();
          }}
        />
        {failed ? (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.text, textAlign: rtl ? 'right' : 'left' }}>
            {t.loginFailed}
          </Text>
        ) : null}
        <Pressable
          onPress={() => {
            void submit();
          }}
          disabled={busy || !email.trim() || !password}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || !email.trim() || !password }}
          style={[
            tailwind.style('py-[11px] items-center rounded-[13px]'),
            { backgroundColor: colors.primary },
          ]}>
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={tailwind.style('text-base font-medium text-white')}>{t.signIn}</Text>
          )}
        </Pressable>
        <LanguageChoice />
      </View>
    </KeyboardAvoidingView>
  );
}
