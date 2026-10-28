import React, { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Text, TextInput } from './typography';
import { FigmaButton, FigmaIcon } from './figma';
import { useLocale } from './locale';
import { useColors } from './ui';

export function PersonAvatar({
  image,
  name,
  size = 40,
}: {
  image?: string | null;
  name: string;
  size?: number;
}) {
  const colors = useColors();
  return image ? (
    <Image
      source={{ uri: image }}
      accessible={false}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontSize: size > 60 ? 30 : 15, color: colors.secondary }}>
        {Array.from(name.trim())[0]?.toLocaleUpperCase() || '?'}
      </Text>
    </View>
  );
}

export function ScreenHeading({
  title,
  back,
  children,
}: {
  title: string;
  back: () => void;
  children?: ReactNode;
}) {
  const { t, rtl } = useLocale();
  const colors = useColors();
  return (
    <View
      style={{
        minHeight: 64,
        paddingHorizontal: 8,
        flexDirection: rtl ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
      }}>
      <FigmaButton name="back" label={t.back} onPress={back} />
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 24,
          lineHeight: 30,
          fontWeight: '700',
          color: colors.text,
        }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function DirectorySearch({
  value,
  change,
  placeholder,
}: {
  value: string;
  change: (value: string) => void;
  placeholder: string;
}) {
  const colors = useColors();
  const { rtl } = useLocale();
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 4,
        marginBottom: 8,
        paddingHorizontal: 10,
        height: 36,
        borderRadius: 10,
        backgroundColor: colors.surface,
        flexDirection: rtl ? 'row-reverse' : 'row',
        gap: 8,
        alignItems: 'center',
      }}>
      <FigmaIcon name="search" />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.secondary}
        value={value}
        onChangeText={change}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          lineHeight: 20,
          paddingVertical: 0,
          height: 36,
          color: colors.text,
        }}
      />
    </View>
  );
}

export function DirectoryTab({
  label,
  selected,
  press,
}: {
  label: string;
  selected: boolean;
  press: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="tab"
      aria-selected={selected}
      accessibilityState={{ selected }}
      onPress={press}
      style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
      <View
        style={{
          height: 28,
          borderRadius: 16,
          backgroundColor: selected ? colors.surface : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: selected ? colors.text : colors.secondary,
          }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
