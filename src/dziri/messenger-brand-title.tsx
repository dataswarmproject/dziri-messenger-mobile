import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { useMessengerTitle } from './messenger-title.generated';

export function MessengerBrandTitle({ title }: { title: string }) {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      changed = true;
      if (active) setReducedMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (active && !changed) setReducedMotion(value);
      })
      .catch(() => {
        if (active && !changed) setReducedMotion(true);
      });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const frame = useMessengerTitle(title, reducedMotion);
  return (
    <Text
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ writingDirection: /^[A-Za-z]/.test(frame.text) ? 'ltr' : 'auto' }}>
      {frame.text}
      {frame.cursor ? '\u200a|' : ''}
    </Text>
  );
}
