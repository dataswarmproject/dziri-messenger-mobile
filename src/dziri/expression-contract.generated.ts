/** Portable expression contract. No DOM, React, credentials or message text storage. */
export type Expression =
  | { kind: 'emoji'; unicode: string }
  | { kind: 'sticker'; stickerId: string }
  | { kind: 'gif'; provider: 'giphy'; id: string };
export type ExpressionKind = Expression['kind'];
export type ExpressionSurface = 'chat' | 'business' | 'comment' | 'post' | 'story' | 'reaction';
export function surfaceExpressions(surface: ExpressionSurface): ExpressionKind[] {
  return surface === 'chat' ? ['emoji', 'gif', 'sticker'] : ['emoji'];
}

/** Selection offsets follow native input UTF-16 offsets. Snap to graphemes. */
export function insertExpression(
  value: string,
  start: number,
  end: number,
  unicode: string,
  maxLength: number,
  graphemes?: Iterable<{ index: number; segment: string }>,
) {
  if (![start, end, maxLength].every(Number.isFinite) || start < 0 || end < start || !unicode)
    return null;
  const segments = [
    ...(graphemes ?? new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)),
  ];
  const boundaries = [0, ...segments.map(x => x.index + x.segment.length)];
  start = Math.min(Math.trunc(start), value.length);
  end = Math.min(Math.trunc(end), value.length);
  const from = [...boundaries].reverse().find(x => x <= start) ?? 0;
  const to = boundaries.find(x => x >= end) ?? value.length;
  const next = value.slice(0, from) + unicode + value.slice(to);
  return next.length <= maxLength ? { value: next, caret: from + unicode.length } : null;
}

/** Search-only normalization. Never normalize persisted messages or Unicode emoji. */
export function normalizeExpressionSearch(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}|ـ/gu, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
export const DARIJA_EXPRESSIONS = [
  {
    id: 'saha',
    label: 'صحا',
    aliases: ['saha', 'sa7a', 'sahha', 'صحة', 'صحا', 'thanks', 'merci'],
    emoji: ['🙏', '❤️', '👍'],
  },
  {
    id: 'wach-rak',
    label: 'واش راك',
    aliases: ['wach rak', 'wesh rak', 'wechrak', 'واش راك', 'how are you', 'comment ça va'],
    emoji: ['👋', '🙂'],
  },
  {
    id: 'labas',
    label: 'لاباس',
    aliases: ['labas', 'la bas', 'لاباس', 'fine', 'ça va', 'bien'],
    emoji: ['👌', '😊'],
  },
  {
    id: 'yaatik-saha',
    label: 'يعطيك الصحة',
    aliases: ['yaatik saha', 'ya3tik sa7a', 'yatik saha', 'يعطيك الصحة', 'well done', 'bravo'],
    emoji: ['👏', '💪', '🙏'],
  },
  {
    id: 'bezzaf',
    label: 'بزاف',
    aliases: ['bezzaf', 'bezaf', 'bzzaf', 'بزاف', 'a lot', 'beaucoup'],
    emoji: ['💯', '🔥'],
  },
  {
    id: 'mabrouk',
    label: 'مبروك',
    aliases: ['mabrouk', 'mabrook', 'مبروك', 'congratulations', 'félicitations'],
    emoji: ['🎉', '🥳', '🎊'],
  },
  {
    id: 'rabi-yahafdek',
    label: 'ربي يحفظك',
    aliases: [
      'rabi yahafdek',
      'rabi y7afdek',
      'rabbi yehafdek',
      'ربي يحفظك',
      'bless you',
      'que dieu te protège',
    ],
    emoji: ['🤲', '❤️', '🙏'],
  },
] as const;
export function searchDarija(search: string) {
  const needle = normalizeExpressionSearch(search);
  return needle
    ? DARIJA_EXPRESSIONS.filter(x =>
        [x.label, ...x.aliases].some(alias => normalizeExpressionSearch(alias).includes(needle)),
      )
    : [];
}
export type EmojiArtwork = 'native' | 'twemoji' | 'openmoji';
export type ExpressionAlias = { alias: string; target: string };
export function expandExpressionSearch(search: string, aliases: ExpressionAlias[] = []) {
  const needle = normalizeExpressionSearch(search);
  return [
    ...new Set([
      search,
      ...searchDarija(search).map(x => x.label),
      ...aliases
        .slice(0, 100)
        .filter(x => normalizeExpressionSearch(x.alias) === needle)
        .map(x => x.target),
    ]),
  ].slice(0, 12);
}
export function expressionArtworkUrl(
  unicode: string,
  artwork: EmojiArtwork,
  ownedAssetBase?: string,
) {
  if (artwork === 'native' || !ownedAssetBase?.startsWith('/') || ownedAssetBase.startsWith('//'))
    return null;
  if (
    !unicode ||
    unicode.length > 32 ||
    !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(unicode) ||
    /[^\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200d\ufe0f\u20e3\d#*]/u.test(
      unicode,
    )
  )
    return null;
  const points = Array.from(unicode).map(c => c.codePointAt(0)!.toString(16));
  const code =
    artwork === 'twemoji' && !unicode.includes('\u200d')
      ? points.filter(p => p !== 'fe0f').join('-')
      : points.join('-');
  return `${ownedAssetBase.replace(/\/$/, '')}/${artwork === 'openmoji' ? code.toUpperCase() : code}.svg`;
}
