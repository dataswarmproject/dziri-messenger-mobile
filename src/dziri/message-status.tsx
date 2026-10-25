import React from 'react';
import { View } from 'react-native';
import { Icon, IconButton } from './icons';
import type { DeliveryState } from './message-policy';
import { useLocale } from './locale';
import { useColors } from './ui';
export function MessageStatus({ state, info }: { state: DeliveryState; info: () => void }) {
  const { t } = useLocale();
  const colors = useColors();
  if (state === 'failed')
    return <IconButton name="info" color={colors.text} label={t.notDelivered} onPress={info} />;
  const label = state === 'sent' ? t.sent : t[state];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ height: 22, justifyContent: 'center', flexShrink: 0 }}>
      <Icon
        name={state === 'read' || state === 'delivered' ? 'doubleCheck' : 'check'}
        size={16}
        color={state === 'read' ? colors.primary : colors.secondary}
      />
    </View>
  );
}
