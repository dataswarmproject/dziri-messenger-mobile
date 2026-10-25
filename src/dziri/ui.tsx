import React from 'react';
import { ActivityIndicator, Pressable, View, useColorScheme } from 'react-native';
import { Text } from './typography';
import { tailwind } from '../theme';
import { colorsFor } from './theme';
import { useLocale, type Locale } from './locale';

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

export function LanguageChoice() {
  const { locale, setLocale } = useLocale();
  const colors = useColors();
  return (
    <View style={tailwind.style('flex-row justify-center gap-4 py-3')}>
      {(['en', 'fr', 'ar'] as Locale[]).map(language => (
        <Pressable
          key={language}
          accessibilityRole="button"
          accessibilityState={{ selected: locale === language }}
          accessibilityLabel={{ en: 'English', fr: 'Français', ar: 'العربية' }[language]}
          onPress={() => setLocale(language)}
          style={tailwind.style('p-3')}>
          <Text style={{ color: locale === language ? colors.primary : colors.secondary }}>
            {{ en: 'English', fr: 'Français', ar: 'العربية' }[language]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
