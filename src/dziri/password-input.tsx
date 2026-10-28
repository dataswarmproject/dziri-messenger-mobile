import React, { useRef, useState } from 'react';
import { Pressable, View, type TextInput as NativeInput, type TextInputProps } from 'react-native';
import { TextInput } from './typography';
import { Icon } from './icons';
import { useColors } from './ui';
import { useLocale } from './locale';

export function PasswordInput({ style, ...props }: Omit<TextInputProps, 'secureTextEntry'>) {
  const [visible, setVisible] = useState(false);
  const input = useRef<NativeInput>(null);
  const colors = useColors();
  const { t, rtl } = useLocale();
  return (
    <View
      style={{
        minHeight: 50,
        flexDirection: rtl ? 'row-reverse' : 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 13,
        backgroundColor: colors.surface,
      }}>
      <TextInput
        {...props}
        ref={input}
        secureTextEntry={!visible}
        style={[
          style,
          {
            flex: 1,
            minWidth: 0,
            borderWidth: 0,
            backgroundColor: 'transparent',
            writingDirection: 'ltr',
          },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${visible ? t.hidePassword : t.showPassword}: ${props.accessibilityLabel || t.password}`}
        aria-pressed={visible}
        disabled={props.editable === false}
        onPress={() => {
          setVisible(value => !value);
          requestAnimationFrame(() => input.current?.focus());
        }}
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: props.editable === false ? 0.5 : 1,
        }}>
        <Icon name={visible ? 'eyeOff' : 'eye'} color={colors.secondary} />
      </Pressable>
    </View>
  );
}
