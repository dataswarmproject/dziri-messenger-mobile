export type MarketplaceWriteContext = {
  expectedActorId: string;
  authorityKey: string;
};
export type MarketplaceWriteScope = {
  conversationId: string;
  storeId?: string;
  companyId?: string;
  commandContext: MarketplaceWriteContext;
};
/** Matches DM's existing encrypted-journal namespace for canonical opaque IDs. */
export function marketplaceDraftScope(conversationId: string, storeId?: string) {
  return `marketplace:${storeId ?? 'buyer'}:${conversationId}`;
}
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 256;

/** Persisted intent is checked and copied; malformed or legacy commands are never rebound. */
export function copyMarketplaceWriteScope(value: unknown): MarketplaceWriteScope {
  if (
    !value ||
    typeof value !== 'object' ||
    !('conversationId' in value) ||
    !id(value.conversationId) ||
    ('storeId' in value && value.storeId !== undefined && !id(value.storeId)) ||
    ('companyId' in value && value.companyId !== undefined && !id(value.companyId)) ||
    !('commandContext' in value) ||
    !value.commandContext ||
    typeof value.commandContext !== 'object' ||
    !('expectedActorId' in value.commandContext) ||
    !id(value.commandContext.expectedActorId) ||
    !('authorityKey' in value.commandContext) ||
    typeof value.commandContext.authorityKey !== 'string' ||
    !/^v1:[a-f0-9]{64}$/.test(value.commandContext.authorityKey)
  )
    throw new Error('Invalid captured messaging access');
  return Object.freeze({
    conversationId: value.conversationId,
    ...('storeId' in value && id(value.storeId) ? { storeId: value.storeId } : {}),
    ...('companyId' in value && id(value.companyId) ? { companyId: value.companyId } : {}),
    commandContext: Object.freeze({
      expectedActorId: value.commandContext.expectedActorId,
      authorityKey: value.commandContext.authorityKey,
    }),
  });
}
export function captureMarketplaceWriteScope(options: {
  actorId?: string;
  conversationId: string;
  storeId?: string;
  companyId?: string;
  context?: MarketplaceWriteContext | null;
  supported: boolean;
}): MarketplaceWriteScope | null {
  const { actorId, conversationId, storeId, companyId, context, supported } = options;
  if (!supported || !actorId || context?.expectedActorId !== actorId) return null;
  try {
    return copyMarketplaceWriteScope({
      conversationId,
      storeId,
      companyId,
      commandContext: context,
    });
  } catch {
    return null;
  }
}
export function marketplaceWriteScopeKey(scope?: MarketplaceWriteScope | null) {
  return scope
    ? JSON.stringify([
        scope.conversationId,
        scope.storeId ?? null,
        scope.companyId ?? null,
        scope.commandContext.expectedActorId,
        scope.commandContext.authorityKey,
      ])
    : '';
}
export function assertMarketplaceWriteScope(
  current?: MarketplaceWriteScope | null,
  captured?: MarketplaceWriteScope | null,
) {
  if (
    !current ||
    !captured ||
    marketplaceWriteScopeKey(current) !== marketplaceWriteScopeKey(captured)
  )
    throw new Error('Messaging access changed');
}
export type PersonalWriteContext = MarketplaceWriteContext;
export type PersonalWriteScope = {
  threadId: string;
  commandContext: PersonalWriteContext;
};
export function copyPersonalWriteScope(value: unknown): PersonalWriteScope {
  if (
    !value ||
    typeof value !== 'object' ||
    !('threadId' in value) ||
    !id(value.threadId) ||
    !('commandContext' in value)
  )
    throw new Error('Invalid captured messaging access');
  const checked = copyMarketplaceWriteScope({
    conversationId: value.threadId,
    commandContext: value.commandContext,
  });
  return Object.freeze({
    threadId: value.threadId,
    commandContext: checked.commandContext,
  });
}
export function capturePersonalWriteScope(options: {
  actorId?: string;
  threadId: string;
  context?: PersonalWriteContext | null;
  supported: boolean;
}): PersonalWriteScope | null {
  if (
    !options.supported ||
    !options.actorId ||
    options.context?.expectedActorId !== options.actorId
  )
    return null;
  try {
    return copyPersonalWriteScope({
      threadId: options.threadId,
      commandContext: options.context,
    });
  } catch {
    return null;
  }
}
export function personalWriteScopeKey(scope?: PersonalWriteScope | null) {
  return scope
    ? JSON.stringify([
        scope.threadId,
        scope.commandContext.expectedActorId,
        scope.commandContext.authorityKey,
      ])
    : '';
}
export function assertPersonalWriteScope(
  current?: PersonalWriteScope | null,
  captured?: PersonalWriteScope | null,
) {
  if (!current || !captured || personalWriteScopeKey(current) !== personalWriteScopeKey(captured))
    throw new Error('Messaging access changed');
}
/** Idempotency keys are scoped to sender on the server, including inside store teams. */
export function ownConfirmedMessageIds(
  rows: readonly { senderId: string; clientMessageId?: string }[],
  actorId?: string,
) {
  return actorId
    ? rows.flatMap(row =>
        row.senderId === actorId && row.clientMessageId ? [row.clientMessageId] : [],
      )
    : [];
}
export const marketplaceWriteCopy = {
  en: 'Sending is unavailable until your messaging access is confirmed. Your draft is kept.',
  fr: 'L’envoi est indisponible tant que votre accès à la messagerie n’est pas confirmé. Votre brouillon est conservé.',
  ar: 'الإرسال غير متاح حتى يتم تأكيد صلاحية المراسلة. تم الاحتفاظ بمسودتك.',
};
export const personalWriteCopy = marketplaceWriteCopy;
export type QueuedMessageReview = {
  id: string;
  body: string;
  attachment?: string;
};
export const localCopyRemovalCopy = {
  en: {
    remove: 'Remove local copy',
    title: 'Remove local copy?',
    description:
      'Remove this saved message and attachment from the local queue? Your current draft stays. This does not delete or cancel a submitted message.',
    confirm: 'Remove this local copy',
    cancel: 'Keep local copy',
    busy: 'Removing local copy…',
    failed: 'Could not confirm local removal. Review the saved copy again.',
  },
  fr: {
    remove: 'Retirer la copie locale',
    title: 'Retirer la copie locale ?',
    description:
      'Retirer ce message et sa pièce jointe de la file locale ? Votre brouillon actuel est conservé. Cela ne supprime ni n’annule un message déjà envoyé.',
    confirm: 'Retirer cette copie locale',
    cancel: 'Garder la copie locale',
    busy: 'Suppression de la copie locale…',
    failed:
      'Impossible de confirmer la suppression locale. Vérifiez à nouveau la copie enregistrée.',
  },
  ar: {
    remove: 'إزالة النسخة المحلية',
    title: 'إزالة النسخة المحلية؟',
    description:
      'هل تريد إزالة هذه الرسالة ومرفقها من قائمة الانتظار المحلية؟ تبقى المسودة الحالية. لن يؤدي ذلك إلى حذف رسالة سبق إرسالها أو إلغاء إرسالها.',
    confirm: 'إزالة هذه النسخة المحلية',
    cancel: 'الاحتفاظ بالنسخة المحلية',
    busy: 'جارٍ إزالة النسخة المحلية…',
    failed: 'تعذر تأكيد الإزالة المحلية. راجع النسخة المحفوظة مجدداً.',
  },
};
export function reviewedDraftText(original: string, draft: string) {
  if (!original || original.length > 8000) return null;
  const body = draft === original ? draft : draft ? `${draft}\n${original}` : original;
  return body.length <= 8000 ? body : null;
}
export const queuedMessageCopy = {
  en: {
    held: 'Needs review',
    review: 'Review message',
    title: 'Review queued message',
    description:
      'This message may already have arrived. Check the chat before sending again. Nothing is sent here.',
    use: 'Copy text to draft',
    append: 'Add text to current draft',
    keep: 'Keep for later',
    attachment: 'Attachment',
    media:
      'The attachment stays with the original message. Review it there and reattach it if you choose to send again.',
    copied: 'Text added to draft. The original message is kept.',
    changed: 'Your draft changed. Both texts are kept; review again.',
    tooLong: 'The combined draft exceeds 8,000 characters. Both texts are kept.',
  },
  fr: {
    held: 'À vérifier',
    review: 'Vérifier le message',
    title: 'Vérifier le message en attente',
    description:
      'Ce message est peut-être déjà arrivé. Vérifiez la discussion avant de le renvoyer. Rien n’est envoyé ici.',
    use: 'Copier le texte au brouillon',
    append: 'Ajouter au brouillon actuel',
    keep: 'Garder pour plus tard',
    attachment: 'Pièce jointe',
    media:
      'La pièce jointe reste avec le message d’origine. Consultez-la et joignez-la à nouveau si vous décidez de renvoyer le message.',
    copied: 'Texte ajouté au brouillon. Le message d’origine est conservé.',
    changed: 'Votre brouillon a changé. Les deux textes sont conservés ; vérifiez à nouveau.',
    tooLong: 'Le brouillon combiné dépasse 8 000 caractères. Les deux textes sont conservés.',
  },
  ar: {
    held: 'بحاجة إلى المراجعة',
    review: 'مراجعة الرسالة',
    title: 'مراجعة رسالة في الانتظار',
    description:
      'قد تكون هذه الرسالة وصلت بالفعل. تحقق من المحادثة قبل إرسالها مجدداً. لن يتم إرسال شيء هنا.',
    use: 'نسخ النص إلى المسودة',
    append: 'إضافة النص إلى المسودة الحالية',
    keep: 'الاحتفاظ بها لوقت لاحق',
    attachment: 'مرفق',
    media: 'يبقى المرفق مع الرسالة الأصلية. راجعه هناك وأرفقه مجدداً إذا اخترت إعادة الإرسال.',
    copied: 'تمت إضافة النص إلى المسودة. تم الاحتفاظ بالرسالة الأصلية.',
    changed: 'تغيّرت المسودة. تم الاحتفاظ بالنصين؛ راجعهما مجدداً.',
    tooLong: 'يتجاوز النص المجمّع 8000 حرف. تم الاحتفاظ بالنصين.',
  },
};
export const marketplaceDraftRecoveryCopy = {
  en: {
    title: 'Older saved draft',
    review: 'Review draft',
    description: 'Review this older draft before using it in this chat.',
    use: 'Use in this chat',
    append: 'Add to current draft',
    keep: 'Keep for later',
    changed: 'Your draft changed. Recovery stopped to protect your text.',
    'too-long': 'The combined draft exceeds 8,000 characters. Both drafts have been kept.',
    unavailable: 'Could not save the recovered text. Your older draft has been kept.',
    copied: 'Text added. The older copy could not be cleared and has been kept.',
  },
  fr: {
    title: 'Ancien brouillon enregistré',
    review: 'Vérifier le brouillon',
    description: 'Vérifiez cet ancien brouillon avant de l’utiliser dans cette discussion.',
    use: 'Utiliser ici',
    append: 'Ajouter au brouillon actuel',
    keep: 'Garder pour plus tard',
    changed: 'Votre brouillon a changé. La récupération a été arrêtée pour protéger votre texte.',
    'too-long': 'Le brouillon combiné dépasse 8 000 caractères. Les deux textes ont été conservés.',
    unavailable: 'Impossible d’enregistrer le texte récupéré. L’ancien brouillon a été conservé.',
    copied: 'Texte ajouté. L’ancienne copie n’a pas pu être effacée et a été conservée.',
  },
  ar: {
    title: 'مسودة قديمة محفوظة',
    review: 'مراجعة المسودة',
    description: 'راجع هذه المسودة القديمة قبل استخدامها في هذه المحادثة.',
    use: 'استخدامها هنا',
    append: 'إضافتها إلى المسودة الحالية',
    keep: 'الاحتفاظ بها لوقت لاحق',
    changed: 'تغيّرت المسودة. تم إيقاف الاستعادة لحماية النص.',
    'too-long': 'يتجاوز النص المجمّع 8000 حرف. تم الاحتفاظ بالمسودتين.',
    unavailable: 'تعذر حفظ النص المستعاد. تم الاحتفاظ بالمسودة القديمة.',
    copied: 'تمت إضافة النص. تعذر حذف النسخة القديمة وتم الاحتفاظ بها.',
  },
};
