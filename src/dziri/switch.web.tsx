import React from 'react';
import { useColors } from './ui';
import { useLocale } from './locale';
import { messengerMetrics as metrics } from './colors';

// A native button gives role=switch both Space and Enter activation on the web.
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
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => change(!checked)}
      style={{
        width: metrics.touchTarget,
        height: metrics.touchTarget,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: 0,
        padding: 0,
        background: 'transparent',
        outline: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}>
      <span
        style={{
          width: metrics.switchWidth,
          height: metrics.switchHeight,
          display: 'block',
          position: 'relative',
          boxSizing: 'border-box',
          borderRadius: metrics.switchHeight / 2,
          backgroundColor: checked ? colors.primary : colors.switchOffTrack,
          border: `1px solid ${checked ? colors.primary : colors.switchOffTrack}`,
        }}>
        <span
          style={{
            display: 'block',
            position: 'absolute',
            top: 1,
            left: (rtl ? !checked : checked) ? metrics.switchWidth - metrics.switchThumb - 3 : 1,
            width: metrics.switchThumb,
            height: metrics.switchThumb,
            borderRadius: metrics.switchThumb / 2,
            backgroundColor: checked ? colors.onPrimary : colors.switchOffThumb,
          }}
        />
      </span>
    </button>
  );
}
