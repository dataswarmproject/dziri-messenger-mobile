import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  View,
  useWindowDimensions,
  Platform,
  type TextProps,
} from 'react-native';
import { Image } from 'expo-image';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { colorsFor } from './dziri/theme';
import { useLocale, type Locale } from './dziri/locale';

const colors = colorsFor(true);
const arabicFont = Platform.select({
  web: 'Arial, sans-serif',
  android: 'sans-serif',
  default: 'System',
});
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  shell: { width: '100%', maxWidth: 1080, flexGrow: 1, alignSelf: 'center' },
  header: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background,
    isolation: 'isolate',
  },
  // Screen composition makes the baked-in black invisible without changing the approved artwork.
  logo: { width: 64, height: 64, mixBlendMode: 'screen' },
  wordmark: { color: colors.text, fontFamily: 'Inter-600-20', fontSize: 25, letterSpacing: -0.8 },
  brandLabel: {
    color: colors.secondary,
    fontFamily: 'Inter-400-20',
    fontSize: 9,
    letterSpacing: 2.3,
    marginTop: 2,
  },
  languages: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
  },
  language: {
    minWidth: 38,
    minHeight: 38,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  languageText: { fontFamily: 'Inter-500-24', fontSize: 11, color: colors.secondary },
  main: { flexGrow: 1, justifyContent: 'center' },
  intro: { gap: 22 },
  eyebrowRow: { alignItems: 'center', gap: 10 },
  accent: { height: 2, width: 24, backgroundColor: colors.primary },
  eyebrow: {
    color: colors.secondary,
    fontFamily: 'Inter-500-24',
    fontSize: 11,
    letterSpacing: 1.3,
  },
  heading: { fontFamily: 'Inter-600-20', color: colors.text, letterSpacing: -1.8 },
  headingSecond: { color: colors.secondary },
  description: {
    color: colors.secondary,
    fontFamily: 'Inter-400-20',
    fontSize: 15,
    lineHeight: 25,
    maxWidth: 330,
  },
  choices: { gap: 14 },
  sectionTitle: {
    color: colors.text,
    fontFamily: 'Inter-600-20',
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  sectionHint: {
    color: colors.secondary,
    fontFamily: 'Inter-400-20',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 5,
    marginBottom: 12,
  },
  card: { padding: 20, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 16 },
  icon: { height: 42, width: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontFamily: 'Inter-600-20', fontSize: 17, lineHeight: 24 },
  cardDescription: {
    color: colors.secondary,
    fontFamily: 'Inter-400-20',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 5,
  },
  arrow: { fontSize: 23, fontFamily: 'Inter-400-20' },
  access: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingTop: 12,
  },
  accessText: {
    fontFamily: 'Inter-400-20',
    color: colors.secondary,
    fontSize: 11,
    lineHeight: 18,
    flexShrink: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  footerText: { fontFamily: 'Inter-400-20', color: colors.secondary, fontSize: 11, lineHeight: 18 },
});

function Text({ style, ...props }: TextProps) {
  const { rtl } = useLocale();
  const font = StyleSheet.flatten(style)?.fontFamily;
  const arabic = rtl && style !== styles.wordmark && style !== styles.brandLabel;
  return (
    <NativeText
      {...props}
      style={[
        style,
        arabic && {
          fontFamily: arabicFont,
          letterSpacing: 0,
          fontWeight:
            font === 'Inter-600-20'
              ? '600'
              : font === 'Inter-500-24'
                ? '500'
                : font === 'Inter-400-20'
                  ? '400'
                  : undefined,
        },
      ]}
    />
  );
}

export function EntryScreen({ choose }: { choose: (view: 'customer' | 'team') => void }) {
  const { t, locale, setLocale, rtl } = useLocale();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const small = width < 380;
  const row = rtl ? 'row-reverse' : 'row';
  const textAlign = rtl ? 'right' : 'left';
  const [fonts, error] = useFonts({
    'Inter-400-20': require('./assets/fonts/Inter-400-20.ttf'),
    'Inter-500-24': require('./assets/fonts/Inter-500-24.ttf'),
    'Inter-600-20': require('./assets/fonts/Inter-600-20.ttf'),
  });
  if (!fonts && !error) return <View style={styles.page} />;
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: wide ? 56 : 24,
        paddingTop: wide ? 32 : 20,
        paddingBottom: 22,
      }}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        <View style={[styles.header, { flexDirection: row }]}>
          <View accessibilityLabel={t.app} style={[styles.brand, { flexDirection: row }]}>
            <Image
              source={require('../assets/dziri-ring.png')}
              style={[styles.logo, small && { width: 44, height: 44 }]}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
            <View>
              <Text style={styles.wordmark}>dziri</Text>
              <Text style={styles.brandLabel}>MESSENGER</Text>
            </View>
          </View>
          <View style={styles.languages}>
            {(['en', 'fr', 'ar'] as Locale[]).map(language => (
              <LanguageButton
                key={language}
                language={language}
                selected={locale === language}
                onPress={() => setLocale(language)}
              />
            ))}
          </View>
        </View>

        <View
          style={[
            styles.main,
            {
              flexDirection: wide ? row : 'column',
              alignItems: wide ? 'center' : 'stretch',
              gap: wide ? 72 : 38,
              paddingTop: wide ? 64 : 48,
              paddingBottom: wide ? 72 : 44,
            },
          ]}>
          <View
            style={[
              styles.intro,
              { flex: wide ? 1 : undefined, alignItems: rtl ? 'flex-end' : 'flex-start' },
            ]}>
            <View style={[styles.eyebrowRow, { flexDirection: row }]}>
              <View style={styles.accent} />
              <Text style={styles.eyebrow}>{t.entryEyebrow}</Text>
            </View>
            <Text
              accessibilityRole="header"
              style={[
                styles.heading,
                {
                  fontSize: wide ? 48 : small ? 32 : 37,
                  lineHeight: wide ? 59 : 46,
                  textAlign,
                  letterSpacing: rtl ? 0 : -1.8,
                },
              ]}>
              {t.entryHeading}
              {'\n'}
              <Text style={styles.headingSecond}>{t.entryHeadingSecond}</Text>
            </Text>
            <Text style={[styles.description, { textAlign }]}>{t.entryDescription}</Text>
          </View>

          <View style={[styles.choices, { width: wide ? 420 : '100%' }]}>
            <View>
              <Text accessibilityRole="header" style={[styles.sectionTitle, { textAlign }]}>
                {t.entryTitle}
              </Text>
              <Text style={[styles.sectionHint, { textAlign }]}>{t.entryHint}</Text>
            </View>
            <SpaceCard
              kind="customer"
              title={t.customerView}
              description={t.customerViewHint}
              onPress={() => choose('customer')}
              rtl={rtl}
            />
            <SpaceCard
              kind="team"
              title={t.teamView}
              description={t.teamViewHint}
              onPress={() => choose('team')}
              rtl={rtl}
            />
            <View style={[styles.access, { flexDirection: row }]}>
              <View
                style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.secondary }}
              />
              <Text style={[styles.accessText, { textAlign }]}>{t.roleHint}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.footer, { flexDirection: row }]}>
          <Text style={styles.footerText}>{t.app}</Text>
          <Text style={[styles.footerText, { writingDirection: 'ltr' }]}>
            English · Français · العربية
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function LanguageButton({
  language,
  selected,
  onPress,
}: {
  language: Locale;
  selected: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={{ en: 'English', fr: 'Français', ar: 'العربية' }[language]}
      accessibilityState={{ selected }}
      hitSlop={3}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.language,
        {
          backgroundColor: selected || pressed ? colors.border : 'transparent',
          borderWidth: 1,
          borderColor: focused ? colors.primary : 'transparent',
        },
      ]}>
      <Text
        style={[
          styles.languageText,
          { color: selected ? colors.text : colors.secondary },
          language === 'ar' && { fontFamily: arabicFont },
        ]}>
        {{ en: 'EN', fr: 'FR', ar: 'ع' }[language]}
      </Text>
    </Pressable>
  );
}

function SpaceCard({
  kind,
  title,
  description,
  onPress,
  rtl,
}: {
  kind: 'customer' | 'team';
  title: string;
  description: string;
  onPress: () => void;
  rtl: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const active = hovered || focused;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.card,
        {
          flexDirection: rtl ? 'row-reverse' : 'row',
          backgroundColor: active || pressed ? `${colors.primary}0d` : colors.surface,
          borderColor: active || pressed ? colors.primary : colors.border,
        },
      ]}>
      <View
        style={[styles.icon, { backgroundColor: active ? `${colors.primary}20` : colors.border }]}>
        <SpaceIcon kind={kind} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { textAlign: rtl ? 'right' : 'left' }]}>{title}</Text>
        <Text style={[styles.cardDescription, { textAlign: rtl ? 'right' : 'left' }]}>
          {description}
        </Text>
      </View>
      <Text
        importantForAccessibility="no"
        style={[styles.arrow, { color: active ? colors.text : colors.secondary }]}>
        {rtl ? '←' : '→'}
      </Text>
    </Pressable>
  );
}

function SpaceIcon({ kind, color }: { kind: 'customer' | 'team'; color: string }) {
  return kind === 'customer' ? (
    <View style={{ width: 20, height: 17, borderWidth: 1.4, borderColor: color, borderRadius: 5 }}>
      <View style={{ flexDirection: 'row', gap: 3, justifyContent: 'center', marginTop: 6 }}>
        {[0, 1, 2].map(dot => (
          <View
            key={dot}
            style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }}
          />
        ))}
      </View>
      <View
        style={{
          width: 5,
          height: 4,
          borderLeftWidth: 1.4,
          borderColor: color,
          position: 'absolute',
          bottom: -4,
          left: 3,
        }}
      />
    </View>
  ) : (
    <View style={{ width: 23, height: 22 }}>
      <View
        style={{
          position: 'absolute',
          width: 7,
          height: 7,
          borderWidth: 1.4,
          borderColor: color,
          borderRadius: 4,
          top: 0,
          left: 5,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 13,
          height: 9,
          borderWidth: 1.4,
          borderColor: color,
          borderTopLeftRadius: 7,
          borderTopRightRadius: 7,
          top: 11,
          left: 2,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 5,
          height: 6,
          borderWidth: 1.2,
          borderColor: color,
          borderRadius: 3,
          top: 3,
          right: 1,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 5,
          height: 8,
          borderTopWidth: 1.2,
          borderRightWidth: 1.2,
          borderColor: color,
          borderTopRightRadius: 5,
          top: 13,
          right: 0,
        }}
      />
    </View>
  );
}
