import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './typography';
import { tailwind } from '../theme';
import { colorsFor } from './theme';
import { useLocale, type Locale } from './locale';
import { Icon, IconButton } from './icons';

export function useColors() {
  return colorsFor(useColorScheme() === 'dark');
}
export function Notice({ text, busy = false }: { text: string; busy?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        tailwind.style('flex-1 items-center justify-center px-6 gap-3'),
        { backgroundColor: colors.background },
      ]}>
      {busy ? <ActivityIndicator color={colors.primary} /> : null}
      <Text
        accessibilityRole="text"
        style={[tailwind.style('text-base text-center'), { color: colors.text }]}>
        {text}
      </Text>
    </View>
  );
}
export function LanguageMenu() {
  const { locale, setLocale, t, rtl } = useLocale();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        name="globe"
        label={t.language}
        color={colors.text}
        expanded={open}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View
          style={{ flex: 1, paddingTop: insets.top + 64, paddingHorizontal: 16, direction: 'ltr' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.close}
            onPress={() => setOpen(false)}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)' }]}
          />
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={() => setOpen(false)}
            style={{
              width: 248,
              maxWidth: '100%',
              alignSelf: rtl ? 'flex-start' : 'flex-end',
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 16,
              padding: 8,
            }}>
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingStart: 12,
              }}>
              <Text accessibilityRole="header" style={{ fontWeight: '600', color: colors.text }}>
                {t.language}
              </Text>
              <IconButton
                name="close"
                label={t.close}
                color={colors.secondary}
                onPress={() => setOpen(false)}
              />
            </View>
            {(['en', 'fr', 'ar'] as Locale[]).map(language => (
              <Pressable
                key={language}
                accessibilityRole="button"
                accessibilityLabel={{ en: 'English', fr: 'Français', ar: 'العربية' }[language]}
                accessibilityState={{ selected: locale === language }}
                aria-selected={locale === language}
                onPress={() => {
                  setLocale(language);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  minHeight: 48,
                  paddingHorizontal: 12,
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 10,
                  backgroundColor: pressed ? colors.background : 'transparent',
                })}>
                <Text
                  style={{
                    color: locale === language ? colors.primary : colors.text,
                    fontWeight: locale === language ? '600' : '400',
                  }}>
                  {{ en: 'English', fr: 'Français', ar: 'العربية' }[language]}
                </Text>
                {locale === language ? (
                  <Icon name="check" color={colors.primary} size={18} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}
