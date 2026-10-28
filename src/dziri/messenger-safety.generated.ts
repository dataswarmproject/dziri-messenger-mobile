export type RequestState = 'pending' | 'spam' | 'declined';
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
