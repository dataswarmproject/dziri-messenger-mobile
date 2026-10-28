import design from '../../config/messenger-design.json' with { type: 'json' };

export const messengerMetrics = design.metrics;

// Canonical Consumer/standalone design snapshot; keep the staff Inbox isolated.
export function messengerColors(dark: boolean) {
  return dark ? design.dark : design.light;
}
