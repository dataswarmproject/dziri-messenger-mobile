export const inboxActionCopy = {
  en: {
    mute: 'Mute',
    unmute: 'Unmute',
    delete: 'Delete',
    profile: 'Profile',
    block: 'Block',
    unblock: 'Unblock',
    deleteTitle: 'Delete chat history?',
    deleteDescription:
      'This deletes this conversation’s history for your account in Dziri and DM. The other person keeps their copy. New messages can bring this chat back.',
    cancel: 'Cancel',
    failed: 'Could not update this chat. Try again.',
    unavailable: 'This action is temporarily unavailable.',
    actions: 'Chat actions',
    more: 'More',
  },
  fr: {
    mute: 'Sourdine',
    unmute: 'Réactiver',
    delete: 'Supprimer',
    profile: 'Profil',
    block: 'Bloquer',
    unblock: 'Débloquer',
    deleteTitle: 'Supprimer l’historique ?',
    deleteDescription:
      'L’historique de cette conversation sera supprimé pour votre compte dans Dziri et DM. L’autre personne conserve sa copie. De nouveaux messages peuvent faire réapparaître la discussion.',
    cancel: 'Annuler',
    failed: 'Impossible de modifier cette discussion. Réessayez.',
    unavailable: 'Cette action est temporairement indisponible.',
    actions: 'Actions de la discussion',
    more: 'Plus',
  },
  ar: {
    mute: 'كتم',
    unmute: 'إلغاء الكتم',
    delete: 'حذف',
    profile: 'الملف',
    block: 'حظر',
    unblock: 'إلغاء الحظر',
    deleteTitle: 'حذف سجل المحادثة؟',
    deleteDescription:
      'سيُحذف سجل هذه المحادثة من حسابك في دزيري وDM. يحتفظ الطرف الآخر بنسخته. قد تعود المحادثة عند وصول رسائل جديدة.',
    cancel: 'إلغاء',
    failed: 'تعذّر تحديث المحادثة. حاول مجدداً.',
    unavailable: 'هذا الإجراء غير متاح مؤقتاً.',
    actions: 'خيارات المحادثة',
    more: 'المزيد',
  },
} as const;

/** A deletion boundary retires local drafts/queues without touching another account. */
export function historyDraftScope(threadId: string, clearedBefore = 0) {
  return clearedBefore > 0 ? `${threadId}:history:${clearedBefore}` : threadId;
}
