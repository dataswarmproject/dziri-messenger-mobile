import React, { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { messengerMetrics as metrics } from './colors';
import { Text } from './typography';
import { useLocale } from './locale';
import { useColors } from './ui';
import { SettingsIcon, type SettingsIconName } from './settings-icon';
import { FigmaIcon } from './figma';

export function SettingsRow({
  icon,
  title,
  value,
  onPress,
  children,
}: {
  icon: SettingsIconName;
  title: string;
  value?: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const { rtl } = useLocale();
  const colors = useColors();
  const content = (
    <>
      <SettingsIcon name={icon} />
      <View
        style={{
          minHeight: 60,
          flex: 1,
          minWidth: 0,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 10,
          borderBottomWidth: 0.5,
          borderColor: colors.border,
        }}>
        <Text
          style={{
            flex: 1,
            fontSize: metrics.message,
            lineHeight: metrics.messageLine,
            color: colors.text,
          }}>
          {title}
        </Text>
        {value ? (
          <Text
            numberOfLines={1}
            style={{
              maxWidth: '45%',
              fontSize: metrics.preview,
              lineHeight: metrics.previewLine,
              color: colors.secondary,
            }}>
            {value}
          </Text>
        ) : null}
        {children}
        {onPress ? <FigmaIcon name="chevron" /> : null}
      </View>
    </>
  );
  const style = {
    minHeight: 60,
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: rtl ? ('row-reverse' as const) : ('row' as const),
    alignItems: 'center' as const,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={style}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}
