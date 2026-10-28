// Presentation only: do not change stored message text or delivery semantics.
const pictograph = String.raw`(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}(?=\ufe0f)|\u2764)`;
const emoji = new RegExp(
  String.raw`\p{Regional_Indicator}{2}|[#*0-9]\ufe0f?\u20e3|(?!(?:\p{Emoji_Modifier}|\p{Regional_Indicator}))${pictograph}\ufe0f?\p{Emoji_Modifier}?(?:\u200d\p{Extended_Pictographic}\ufe0f?\p{Emoji_Modifier}?)*(?:[\u{E0020}-\u{E007F}]+)?`,
  'gu',
);
export function emojiOnlySize(body: string): number | null {
  const compact = body.replace(/\s/gu, '');
  if (!compact || compact.length > 100) return null;
  const parts = compact.match(emoji);
  if (!parts || parts.join('') !== compact || parts.length > 3) return null;
  return parts.length === 1 ? 48 : parts.length === 2 ? 40 : 34;
}
export function messageTimeBoundary(at: number, previousAt?: number) {
  if (!Number.isFinite(at)) return false;
  return (
    previousAt === undefined ||
    !Number.isFinite(previousAt) ||
    at - previousAt >= 300_000 ||
    new Date(at).toDateString() !== new Date(previousAt).toDateString()
  );
}
export function messageClock(at: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    numberingSystem: 'latn',
  }).format(at);
}
export function messageTimeLabel(at: number, locale: string, now = Date.now()) {
  const date = new Date(at),
    today = new Date(now);
  if (date.toDateString() === today.toDateString()) return messageClock(at, locale);
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    numberingSystem: 'latn',
  }).format(at);
}
export function audioClock(seconds: number) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
export function audioProgress(time: number, duration: number) {
  return duration > 0 && Number.isFinite(duration) && Number.isFinite(time)
    ? Math.max(0, Math.min(1, time / duration))
    : 0;
}
