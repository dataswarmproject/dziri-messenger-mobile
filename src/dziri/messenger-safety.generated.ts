export type RequestState = 'pending' | 'spam' | 'declined';
export function safetyDecisionCopy(locale = 'en') {
  return locale === 'ar'
    ? {
        loading: 'جارٍ التحميل…',
        failed: 'تعذّرت العملية. أغلق النافذة وأعد فتحها لمراجعة أحدث حالة.',
      }
    : locale === 'fr'
      ? {
          loading: 'Chargement…',
          failed: 'Action impossible. Fermez et rouvrez pour vérifier l’état actuel.',
        }
      : {
          loading: 'Loading…',
          failed: 'Could not complete this action. Close and reopen to review the latest state.',
        };
}
/** One mounted account/target lifetime, never an authorization grant. */
export type SafetyOwner<T extends string = string> = Readonly<{
  actorId: T;
  userId: T;
}>;
export type MarketplaceSafetySource = Readonly<{
  conversationId: string;
  storeId?: string;
  companyId?: string;
  sourceKey: string;
}>;
export type SafetyIntent<
  T extends string = string,
  Source extends MarketplaceSafetySource = MarketplaceSafetySource,
> = Readonly<{
  owner: SafetyOwner<T>;
  action: 'block' | 'unblock';
  decisionKey: string;
  marketplace?: Readonly<Source>;
}>;
export function captureSafetyIntent<
  T extends string,
  Source extends MarketplaceSafetySource = MarketplaceSafetySource,
>(
  owner: SafetyOwner<T> | null,
  blocked?: boolean,
  prepared?: {
    blocked: boolean;
    expectedActorId: string;
    decisionKey?: string;
    peerId?: string;
    sourceKey?: string;
  },
  marketplace?: Source,
): SafetyIntent<T, Source> | null {
  return owner &&
    typeof blocked === 'boolean' &&
    prepared?.blocked === blocked &&
    prepared.expectedActorId === owner.actorId &&
    (!marketplace ||
      (prepared.peerId === owner.userId &&
        prepared.sourceKey === marketplace.sourceKey &&
        /^v1:[a-f0-9]{64}$/.test(marketplace.sourceKey))) &&
    /^v1:[a-f0-9]{64}$/.test(prepared.decisionKey ?? '')
    ? Object.freeze({
        owner,
        action: blocked ? 'unblock' : 'block',
        decisionKey: prepared.decisionKey!,
        ...(marketplace ? { marketplace: Object.freeze({ ...marketplace }) } : {}),
      })
    : null;
}
export function sameSafetySource(left?: MarketplaceSafetySource, right?: MarketplaceSafetySource) {
  return !left || !right
    ? left === right
    : left.conversationId === right.conversationId &&
        left.storeId === right.storeId &&
        left.companyId === right.companyId &&
        left.sourceKey === right.sourceKey;
}
export function marketplaceSafetyScopeKey(scope: Omit<MarketplaceSafetySource, 'sourceKey'>) {
  return JSON.stringify([scope.conversationId, scope.storeId ?? null, scope.companyId ?? null]);
}
export function marketplaceSafetyPreparationCommand<
  T extends string,
  Source extends MarketplaceSafetySource,
>(owner: SafetyOwner<T>, blocked: boolean, source: Source) {
  // Keep platform ID brands while copying only the approved public scope fields.
  const scope = {
    conversationId: source.conversationId,
    ...(source.storeId !== undefined ? { storeId: source.storeId } : {}),
    ...(source.companyId !== undefined ? { companyId: source.companyId } : {}),
  } as Pick<Source, 'conversationId'> & Partial<Pick<Source, 'storeId' | 'companyId'>>;
  return {
    ...scope,
    expectedActorId: owner.actorId,
    expectedPeerId: owner.userId,
    expectedSourceKey: source.sourceKey,
    action: blocked ? ('unblock' as const) : ('block' as const),
  };
}
export function marketplaceSafetyIntentCommand<
  T extends string,
  Source extends MarketplaceSafetySource,
>(intent: SafetyIntent<T, Source>) {
  if (!intent.marketplace) throw new Error('Missing Marketplace safety source');
  return {
    ...marketplaceSafetyPreparationCommand(
      intent.owner,
      intent.action === 'unblock',
      intent.marketplace,
    ),
    expectedDecisionKey: intent.decisionKey,
  };
}
export function marketplaceSafetyCopy(locale = 'en') {
  return locale === 'ar'
    ? {
        account: 'حساب دزيري',
        block:
          'سيتم حظر حساب هذا الشخص فقط، دون التأثير على المتجر أو موظفيه الآخرين. يبقى سجل المحادثة محفوظاً.',
        unblock: 'سيتم إلغاء حظر حساب هذا الشخص فقط. يمكنكما استئناف التواصل وفق إعدادات الخصوصية.',
      }
    : locale === 'fr'
      ? {
          account: 'Compte Dziri',
          block:
            'Seul le compte de cette personne sera bloqué. La boutique et ses autres employés ne sont pas concernés. L’historique est conservé.',
          unblock:
            'Seul le compte de cette personne sera débloqué. Les échanges pourront reprendre selon vos paramètres de confidentialité.',
        }
      : {
          account: 'Dziri account',
          block:
            'This blocks only this person’s account. The store and its other staff are unaffected. Chat history is kept.',
          unblock:
            'This unblocks only this person’s account. Messaging can resume according to your privacy settings.',
        };
}
export function isSafetyIntentCurrent<T extends string>(
  intent: SafetyIntent<T> | null,
  owner: SafetyOwner<T> | null,
) {
  return !!intent && !!owner && intent.owner === owner;
}
export function safetyIntentCommand<T extends string>(intent: SafetyIntent<T>) {
  return {
    blockedUserId: intent.owner.userId,
    expectedActorId: intent.owner.actorId,
    expectedDecisionKey: intent.decisionKey,
  };
}
export type RequestView = {
  role: 'sender' | 'recipient';
  state: RequestState;
  canIntroduce: boolean;
};
export type RequestAction = 'accept' | 'decline' | 'spam' | 'restore';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'violence'
  | 'scam'
  | 'sexual'
  | 'other';
export const REPORT_REASONS: ReportReason[] = [
  'spam',
  'harassment',
  'hate',
  'violence',
  'scam',
  'sexual',
  'other',
];
export type ReportTarget = { messageId: string; storeId?: string };
export type ReportPreview = {
  fingerprint: string;
  body?: string;
  senderName?: string;
  type: string;
  attachmentCount: number;
  alreadyReported: boolean;
  state?: 'open' | 'dismissed' | 'restricted';
};
export type RequestRow = {
  threadId: string;
  senderName?: string;
  senderImage?: string;
  preview: string;
  createdAt: number;
};
export function safetyCopy(locale: string) {
  const pick = (en: string, fr: string, ar: string) =>
    locale === 'ar' ? ar : locale === 'fr' ? fr : en;
  return {
    requests: pick('Message requests', 'Invitations par message', 'طلبات المراسلة'),
    pending: pick('Requests', 'Invitations', 'الطلبات'),
    spam: pick('Spam', 'Indésirables', 'رسائل مزعجة'),
    declined: pick('Declined', 'Refusées', 'المرفوضة'),
    empty: pick('No requests here', 'Aucune invitation', 'لا توجد طلبات هنا'),
    intro: pick(
      'Send one text introduction. More messages and media become available after acceptance.',
      'Envoyez un premier texte. Les messages et médias seront disponibles après acceptation.',
      'أرسل رسالة تعريفية واحدة. تتاح بقية الرسائل والوسائط بعد القبول.',
    ),
    waiting: pick(
      'Waiting for this person to accept. Your activity and read status stay private.',
      'En attente d’acceptation. Votre activité et vos lectures restent privées.',
      'في انتظار القبول. يبقى نشاطك وحالة القراءة خاصّين.',
    ),
    received: pick(
      'Accept to reply and share activity and read receipts. You can report this message without accepting.',
      'Acceptez pour répondre et partager l’activité et les confirmations de lecture. Vous pouvez signaler sans accepter.',
      'اقبل للرد ومشاركة النشاط وإيصالات القراءة. يمكنك الإبلاغ دون القبول.',
    ),
    accept: pick('Accept', 'Accepter', 'قبول'),
    decline: pick('Decline', 'Refuser', 'رفض'),
    restore: pick('Move to requests', 'Déplacer vers les invitations', 'نقل إلى الطلبات'),
    reason: pick('Reason', 'Motif', 'السبب'),
    description: pick(
      'Dziri moderators review reports before taking action.',
      'La modération Dziri examine les signalements avant toute action.',
      'يراجع مشرفو دزيري البلاغات قبل اتخاذ إجراء.',
    ),
    report: pick('Report message', 'Signaler le message', 'الإبلاغ عن الرسالة'),
    consent: pick(
      'Share this selected message and its attachments with Dziri moderators. Other messages are not included.',
      'Partager ce message et ses pièces jointes avec la modération Dziri. Les autres messages ne sont pas inclus.',
      'مشاركة هذه الرسالة ومرفقاتها مع مشرفي دزيري. لا تُشارك الرسائل الأخرى.',
    ),
    sent: pick(
      'Report received. Moderators will review it.',
      'Signalement reçu. La modération l’examinera.',
      'تم استلام البلاغ لمراجعته من المشرفين.',
    ),
    existing: pick(
      'You already reported this message.',
      'Vous avez déjà signalé ce message.',
      'سبق أن أبلغت عن هذه الرسالة.',
    ),
    failed: pick(
      'Unable to complete this action. Reopen to review the latest message and try again.',
      'Action impossible. Rouvrez pour vérifier le message actuel et réessayez.',
      'تعذر إكمال العملية. أعد الفتح لمراجعة أحدث رسالة ثم حاول مجدداً.',
    ),
    loading: pick('Loading…', 'Chargement…', 'جارٍ التحميل…'),
    close: pick('Close', 'Fermer', 'إغلاق'),
    more: pick('Load more', 'Charger plus', 'تحميل المزيد'),
    notes: pick(
      'Additional details (optional)',
      'Précisions (facultatif)',
      'تفاصيل إضافية (اختياري)',
    ),
    reasons: {
      spam: pick('Spam', 'Spam', 'إزعاج'),
      harassment: pick('Harassment', 'Harcèlement', 'تحرش أو مضايقة'),
      hate: pick('Hate', 'Haine', 'كراهية'),
      violence: pick('Violence', 'Violence', 'عنف'),
      scam: pick('Scam', 'Arnaque', 'احتيال'),
      sexual: pick('Sexual content', 'Contenu sexuel', 'محتوى جنسي'),
      other: pick('Other', 'Autre', 'سبب آخر'),
    },
  };
}
