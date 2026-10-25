export function consumerTypeface({
  rtl,
  text,
  family,
  weight,
}: {
  rtl: boolean;
  text?: unknown;
  family?: string;
  weight?: string | number;
}) {
  const arabic = rtl || (typeof text === 'string' && /[\u0600-\u06ff]/u.test(text));
  const value =
    weight === 'bold' ? 700 : Number(weight) || Number(family?.match(/Inter-(\d+)/)?.[1]) || 400;
  if (arabic)
    return value >= 550
      ? 'thmanyahsans-Bold'
      : value >= 450
        ? 'thmanyahsans-Medium'
        : 'thmanyahsans-Regular';
  if (family?.startsWith('Inter-')) return family;
  return value >= 550 ? 'Inter-600-20' : value >= 450 ? 'Inter-500-24' : 'Inter-400-20';
}
// Follow the first strong letter, so Arabic drafts also align correctly in EN/FR.
export function messageDirection(text: string, rtl: boolean): 'rtl' | 'ltr' {
  const firstLetter = text.match(/\p{L}/u)?.[0];
  if (!firstLetter) return rtl ? 'rtl' : 'ltr';
  return /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/u.test(firstLetter) ? 'rtl' : 'ltr';
}
