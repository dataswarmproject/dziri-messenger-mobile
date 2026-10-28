import React from 'react';
import { Pressable, View } from 'react-native';
import { useColors } from './ui';
import { useLocale } from './locale';
import { messengerMetrics as metrics } from './colors';

/** Compact shadcn-style geometry, with the same native/web and RTL behavior. */
export function MessengerSwitch({
  label,
  checked,
  change,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  change: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const { rtl } = useLocale();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      aria-checked={checked}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => change(!checked)}
      style={{
        width: metrics.touchTarget,
        height: metrics.touchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}>
      <View
        style={{
          width: metrics.switchWidth,
          height: metrics.switchHeight,
          borderRadius: metrics.switchHeight / 2,
          backgroundColor: checked ? colors.primary : colors.switchOffTrack,
          borderColor: checked ? colors.primary : colors.switchOffTrack,
          borderWidth: 1,
          justifyContent: 'center',
        }}>
        <View
          style={{
            position: 'absolute',
            left: (rtl ? !checked : checked) ? metrics.switchWidth - metrics.switchThumb - 3 : 1,
            width: metrics.switchThumb,
            height: metrics.switchThumb,
            borderRadius: metrics.switchThumb / 2,
            backgroundColor: checked ? colors.onPrimary : colors.switchOffThumb,
          }}
        />
      </View>
    </Pressable>
  );
}
