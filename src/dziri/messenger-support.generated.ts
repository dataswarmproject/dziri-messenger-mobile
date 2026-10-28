export interface SupportContext {
  expectedActorId: string;
  authorityKey: string;
}
export interface SupportResult {
  threadId: string;
  connectionId: string;
  generation: number;
}
export interface SupportPreparation {
  companyId: string;
  name: string;
  available: boolean;
  commandContext?: SupportContext;
  confirmation?: SupportResult & {
    clientCommandId: string;
    payloadHash: string;
  };
}
export interface SupportStatus extends SupportResult {
  connected: boolean;
  ready: boolean;
  phase: 'pending' | 'ready' | 'stopped' | 'unavailable';
  orderId: string | null;
  commandContext: SupportContext;
}
export type SupportStartCommand = {
  companyId: string;
  consent: true;
  clientCommandId: string;
  commandContext: SupportContext;
};
export function captureSupportStart(
  companyId: string,
  context: SupportContext,
  createId: () => string,
): SupportStartCommand {
  return Object.freeze({
    companyId,
    consent: true as const,
    clientCommandId: createId(),
    commandContext: Object.freeze({ ...context }),
  });
}
export function supportStartPayload(command: SupportStartCommand) {
  return JSON.stringify([
    'dziri-support-start-v1',
    command.companyId,
    command.commandContext.expectedActorId,
    command.commandContext.authorityKey,
    command.consent,
  ]);
}
export function validSupportPreparation(
  prepared: SupportPreparation | null | undefined,
  actorId: string,
  companyId: string,
) {
  return (
    !!prepared &&
    prepared.companyId === companyId &&
    prepared.available &&
    prepared.commandContext?.expectedActorId === actorId &&
    /^v1:[a-f0-9]{64}$/.test(prepared.commandContext.authorityKey)
  );
}
export function supportStartConfirmed(
  command: SupportStartCommand,
  hash: string,
  prepared: SupportPreparation | null | undefined,
) {
  const proof = prepared?.confirmation;
  return (
    !!proof &&
    prepared?.commandContext?.expectedActorId === command.commandContext.expectedActorId &&
    prepared?.companyId === command.companyId &&
    proof.clientCommandId === command.clientCommandId &&
    proof.payloadHash === hash
  );
}
export function supportCopy(locale: string) {
  return locale === 'ar'
    ? {
        title: 'دعم العملاء',
        consent: 'أوافق على مشاركة هذه المحادثة مع فريق دعم هذا النشاط التجاري.',
        start: 'بدء المحادثة',
        retry: 'إعادة المحاولة',
        unavailable: 'الدعم غير متاح حاليًا.',
        pending: 'جارٍ ربطك بفريق الدعم…',
        ready: 'متصل بفريق الدعم',
        stopped: 'توقفت مشاركة المحادثة.',
        stop: 'إيقاف المشاركة',
        failed: 'تعذر إكمال الطلب. حاول مجددًا.',
        loading: 'جارٍ التحميل…',
        review: 'تغيّر الاتصال. راجع الموافقة وابدأ مجددًا.',
        open: 'فتح المحادثة',
      }
    : locale === 'fr'
      ? {
          title: 'Assistance',
          consent:
            'J’accepte de partager cette conversation avec l’équipe d’assistance de cette entreprise.',
          start: 'Démarrer la conversation',
          retry: 'Réessayer',
          unavailable: 'L’assistance est indisponible pour le moment.',
          pending: 'Connexion à l’assistance…',
          ready: 'Connecté à l’assistance',
          stopped: 'Le partage de la conversation est arrêté.',
          stop: 'Arrêter le partage',
          failed: 'La demande a échoué. Réessayez.',
          loading: 'Chargement…',
          review: 'La connexion a changé. Vérifiez le consentement et recommencez.',
          open: 'Ouvrir la conversation',
        }
      : {
          title: 'Customer support',
          consent: 'I agree to share this conversation with this business’s support team.',
          start: 'Start conversation',
          retry: 'Try again',
          unavailable: 'Support is currently unavailable.',
          pending: 'Connecting to support…',
          ready: 'Connected to support',
          stopped: 'Conversation sharing stopped.',
          stop: 'Stop sharing',
          failed: 'The request failed. Try again.',
          loading: 'Loading…',
          review: 'The connection changed. Review consent and start again.',
          open: 'Open conversation',
        };
}
