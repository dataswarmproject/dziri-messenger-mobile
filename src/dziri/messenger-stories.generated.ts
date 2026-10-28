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
export interface StoryWriteContext {
  expectedActorId: string;
  authorityKey: string;
}
export interface StoryReplyPreparation {
  writeContext: StoryWriteContext;
  canSend: boolean;
  confirmation?: {
    messageId: string;
    clientMessageId: string;
    payloadHash: string;
    commandContext: StoryWriteContext;
  };
}
export interface StoryReplyCommand {
  storyId: string;
  kind: 'reply' | 'reaction';
  body: string;
  clientMessageId: string;
  commandContext?: StoryWriteContext;
  payloadHash?: string;
}
/** Preserve an immutable intent across an uncertain result; a changed intent gets a new ID. */
export function storyReplyCommand(
  previous: StoryReplyCommand | null,
  storyId: string,
  kind: StoryReplyCommand['kind'],
  body: string,
  makeId: () => string,
  context?: StoryWriteContext,
): StoryReplyCommand {
  const text = body.trim();
  if (
    previous?.storyId === storyId &&
    previous.kind === kind &&
    previous.body === text &&
    previous.commandContext?.expectedActorId === context?.expectedActorId &&
    previous.commandContext?.authorityKey === context?.authorityKey
  )
    return previous;
  return Object.freeze({
    storyId,
    kind,
    body: text,
    clientMessageId: makeId(),
    ...(context ? { commandContext: Object.freeze({ ...context }) } : {}),
  });
}
export function validStoryPreparation(
  prepared: StoryReplyPreparation | null | undefined,
  actorId: string,
): prepared is StoryReplyPreparation {
  return (
    !!actorId &&
    prepared?.writeContext?.expectedActorId === actorId &&
    /^v1:[a-f0-9]{64}$/.test(prepared.writeContext.authorityKey) &&
    typeof prepared.canSend === 'boolean'
  );
}
export function storyReplyConfirmed(
  command: StoryReplyCommand,
  prepared: StoryReplyPreparation | null | undefined,
  actorId: string,
) {
  const proof = prepared?.confirmation,
    captured = command.commandContext;
  return (
    validStoryPreparation(prepared, actorId) &&
    !!captured &&
    captured.expectedActorId === actorId &&
    !!command.payloadHash &&
    proof?.clientMessageId === command.clientMessageId &&
    proof.payloadHash === command.payloadHash &&
    proof.commandContext.expectedActorId === actorId &&
    proof.commandContext.authorityKey === captured.authorityKey
  );
}
export function storyReplyAccepted(
  command: StoryReplyCommand,
  prepared: StoryReplyPreparation | null | undefined,
  actorId: string,
) {
  const captured = command.commandContext;
  if (
    !captured ||
    captured.expectedActorId !== actorId ||
    !validStoryPreparation(prepared, actorId)
  )
    return false;
  return (
    captured.authorityKey === prepared.writeContext.authorityKey ||
    storyReplyConfirmed(command, prepared, actorId)
  );
}
/** Same fixed string tuple as the canonical server Story command hash. */
export function storyReplyPayload(command: Pick<StoryReplyCommand, 'storyId' | 'kind' | 'body'>) {
  return JSON.stringify(['story', command.storyId, command.kind, command.body.trim()]);
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
  held: 'Messaging access changed. Your reply is kept.',
  replyUnavailable: 'Replies are unavailable for this conversation.',
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
  held: 'Votre accès a changé. Votre réponse est conservée.',
  replyUnavailable: 'Les réponses sont indisponibles dans cette conversation.',
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
  held: 'تغيّرت صلاحية المراسلة. تم الاحتفاظ بردّك.',
  replyUnavailable: 'الردود غير متاحة لهذه المحادثة.',
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
