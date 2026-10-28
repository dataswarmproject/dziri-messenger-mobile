type SearchableMessage = {
  body?: string;
  content?: string;
  deletedAt?: number;
  ciphertext?: string;
  moderationStatus?: string;
};
function normalized(text: string, locale: string) {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase(locale)
    .replace(/\s+/g, ' ')
    .trim();
}
export function historyMatches<T extends SearchableMessage>(
  rows: T[],
  query: string,
  locale: string,
): T[] {
  const needle = normalized(query, locale);
  return needle
    ? rows.filter(
        row =>
          row.deletedAt === undefined &&
          !row.ciphertext &&
          row.moderationStatus !== 'blocked' &&
          row.moderationStatus !== 'blurred' &&
          normalized(row.content ?? row.body ?? '', locale).includes(needle),
      )
    : [];
}
