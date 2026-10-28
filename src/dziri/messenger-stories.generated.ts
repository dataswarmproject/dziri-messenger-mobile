export const STORY_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '👏'] as const;
export const STORY_DURATION_MS = 5000;
export const STORY_VIEW_DWELL_MS = 500;
export interface StorySnapshot {
  authorId: string;
  authorName?: string;
  type: string;
  body?: string;
  mediaUrl?: string;
  backgroundHex?: string;
}
export interface StoryReplyCommand {
  storyId: string;
  kind: 'reply' | 'reaction';
  body: string;
  clientMessageId: string;
}
/** Preserve an immutable intent across an uncertain result; a changed intent gets a new ID. */
export function storyReplyCommand(
  previous: StoryReplyCommand | null,
  storyId: string,
  kind: StoryReplyCommand['kind'],
  body: string,
  makeId: () => string,
): StoryReplyCommand {
  const text = body.trim();
  if (previous?.storyId === storyId && previous.kind === kind && previous.body === text)
    return previous;
  return Object.freeze({
    storyId,
    kind,
    body: text,
    clientMessageId: makeId(),
  });
}
const en = {
  title: 'Story',
  quote: 'Story reply',
  close: 'Close story',
  previous: 'Previous story',
  next: 'Next story',
  pause: 'Pause story',
  play: 'Play story',
  loading: 'Loading story…',
  failed: 'This story could not be loaded.',
  retry: 'Retry',
  reply: 'Reply to story',
  send: 'Send reply',
  sending: 'Sending…',
  sent: 'Reply sent',
  sendFailed: 'Could not send. Try again.',
  open: 'Open conversation',
  unavailable: 'Replies are unavailable in this version.',
  reaction: 'React',
  followers: 'Followers',
  public: 'Public',
  audience: 'Story audience',
  publishing: 'Publishing…',
  cancel: 'Cancel',
  failedPublish: 'Could not publish. Try again.',
  expired: 'This story is no longer available.',
};
const fr: typeof en = {
  title: 'Story',
  quote: 'Réponse à une story',
  close: 'Fermer la story',
  previous: 'Story précédente',
  next: 'Story suivante',
  pause: 'Mettre la story en pause',
  play: 'Lire la story',
  loading: 'Chargement de la story…',
  failed: 'Impossible de charger cette story.',
  retry: 'Réessayer',
  reply: 'Répondre à la story',
  send: 'Envoyer la réponse',
  sending: 'Envoi…',
  sent: 'Réponse envoyée',
  sendFailed: 'Envoi impossible. Réessayez.',
  open: 'Ouvrir la conversation',
  unavailable: 'Les réponses sont indisponibles dans cette version.',
  reaction: 'Réagir',
  followers: 'Abonnés',
  public: 'Public',
  audience: 'Audience de la story',
  publishing: 'Publication…',
  cancel: 'Annuler',
  failedPublish: 'Publication impossible. Réessayez.',
  expired: 'Cette story n’est plus disponible.',
};
const ar: typeof en = {
  title: 'قصة',
  quote: 'رد على قصة',
  close: 'إغلاق القصة',
  previous: 'القصة السابقة',
  next: 'القصة التالية',
  pause: 'إيقاف القصة مؤقتاً',
  play: 'تشغيل القصة',
  loading: 'جارٍ تحميل القصة…',
  failed: 'تعذر تحميل هذه القصة.',
  retry: 'إعادة المحاولة',
  reply: 'الرد على القصة',
  send: 'إرسال الرد',
  sending: 'جارٍ الإرسال…',
  sent: 'أُرسل الرد',
  sendFailed: 'تعذر الإرسال. حاول مجدداً.',
  open: 'فتح المحادثة',
  unavailable: 'الردود غير متاحة في هذا الإصدار.',
  reaction: 'تفاعل',
  followers: 'المتابعون',
  public: 'عام',
  audience: 'جمهور القصة',
  publishing: 'جارٍ النشر…',
  cancel: 'إلغاء',
  failedPublish: 'تعذر النشر. حاول مجدداً.',
  expired: 'لم تعد هذه القصة متاحة.',
};
export function storyCopy(locale: string): typeof en {
  return locale === 'ar' ? ar : locale === 'fr' ? fr : en;
}
