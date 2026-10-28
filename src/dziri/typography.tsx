import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Platform,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { useLocale } from './locale';
import { consumerTypeface } from './typeface';
// Web CSS supports `none`, unlike React Native's narrower outline enum.
const browserInputStyle =
  Platform.OS === 'web'
    ? ({ outlineStyle: 'none', outlineWidth: 0, scrollbarWidth: 'none' } as unknown as TextStyle)
    : undefined;

export function Text({ style, ...props }: TextProps) {
  const { rtl } = useLocale();
  const flat = StyleSheet.flatten(style);
  return (
    <NativeText
      {...props}
      style={[
        style,
        {
          fontFamily: consumerTypeface({
            rtl,
            text: props.children,
            family: flat?.fontFamily,
            weight: flat?.fontWeight,
          }),
          fontWeight: 'normal',
          textAlign: flat?.textAlign ?? (rtl ? 'right' : 'left'),
          writingDirection: flat?.writingDirection ?? (rtl ? 'rtl' : 'ltr'),
          ...(rtl ? { letterSpacing: 0 } : {}),
        },
      ]}
    />
  );
}

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput(
  { style, ...props },
  ref,
) {
  const { rtl } = useLocale();
  const flat = StyleSheet.flatten(style);
  const latinInput = props.keyboardType === 'email-address' || props.keyboardType === 'url';
  return (
    <NativeTextInput
      {...props}
      ref={ref}
      style={[
        style,
        browserInputStyle,
        {
          fontFamily: consumerTypeface({
            rtl,
            text: props.value || props.placeholder,
            family: flat?.fontFamily,
            weight: flat?.fontWeight,
          }),
          fontWeight: 'normal',
          textAlign: flat?.textAlign ?? (rtl ? 'right' : 'left'),
          writingDirection: latinInput ? 'ltr' : (flat?.writingDirection ?? (rtl ? 'rtl' : 'ltr')),
          ...(rtl ? { letterSpacing: 0 } : {}),
        },
      ]}
    />
  );
});
