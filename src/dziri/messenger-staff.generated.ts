export type StaffContext = { expectedActorId: string; authorityKey: string };
export type StaffBusiness = { id: string; name: string; role: string };
/** Authenticated staff-only descriptor. It never contains a provider session or SSO URL. */
export type StaffWorkspace = {
  version: 1;
  observationId: string;
  actorId: string;
  companyId: string;
  tenantId: string;
  origin: string;
  remoteUserId: number;
  accountId: number;
  inboxId: number;
  role: 'administrator' | 'agent';
  email: string;
  authorityKey: string;
};
export type StaffEntryProps = {
  actorId: string;
  businesses: StaffBusiness[];
  supported: boolean;
};
export function validStaffWorkspace(
  value: StaffWorkspace | null | undefined,
  actorId: string,
  companyId: string,
): value is StaffWorkspace {
  if (
    !value ||
    value.version !== 1 ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(value.observationId) ||
    value.actorId !== actorId ||
    value.companyId !== companyId ||
    !value.tenantId ||
    !/^v1:[a-f0-9]{64}$/.test(value.authorityKey) ||
    ![value.remoteUserId, value.accountId, value.inboxId].every(
      id => Number.isSafeInteger(id) && id > 0,
    ) ||
    !['agent', 'administrator'].includes(value.role) ||
    !value.email ||
    value.email !== value.email.trim().toLowerCase()
  )
    return false;
  try {
    const origin = new URL(value.origin);
    return (
      origin.protocol === 'https:' &&
      origin.origin === value.origin &&
      !origin.username &&
      !origin.password
    );
  } catch {
    return false;
  }
}
export const staffWorkspaceKey = (value: StaffWorkspace) =>
  JSON.stringify([
    'staff-workspace-v1',
    value.actorId,
    value.companyId,
    value.tenantId,
    value.origin,
    value.remoteUserId,
    value.accountId,
    value.inboxId,
    value.role,
    value.authorityKey,
  ]);
export type StaffJobState = 'pending' | 'processing' | 'delivered' | 'failed';
export type StaffConfirmation = {
  actorId: string;
  companyId: string;
  tenantId: string;
  jobId: string;
  kind: 'tenant' | 'staff';
  clientCommandId: string;
  payloadHash: string;
  status: StaffJobState;
  retryable: boolean;
};
export type StaffStatus = {
  actorId: string;
  companyId: string;
  canConfigure: boolean;
  available: boolean;
  configured: boolean;
  tenantId?: string;
  enabled: boolean;
  ready: boolean;
  staffReady: boolean;
  setupCommandState: StaffJobState | null;
  staffCommandState: StaffJobState | null;
  state: 'unconfigured' | 'pending' | 'ready' | 'disabled' | 'failed';
  commandContext?: StaffContext;
  staffContext?: StaffContext;
  confirmation?: StaffConfirmation;
};
type BaseCommand = {
  companyId: string;
  clientCommandId: string;
  commandContext: StaffContext;
};
export type StaffConfigureCommand = BaseCommand & {
  kind: 'configure';
  enabled: boolean;
  locale: 'en' | 'fr' | 'ar';
};
export type StaffSyncCommand = BaseCommand & { kind: 'sync' };
export type StaffCommand = StaffConfigureCommand | StaffSyncCommand;
export type StaffPending = { command: StaffCommand; hash: string };
export type StaffResult = { tenantId: string; jobId: string };
export type StaffPendingQuery = {
  kind: 'tenant' | 'staff';
  clientCommandId: string;
  payloadHash: string;
};
export const eligibleStaffBusinesses = (businesses: readonly StaffBusiness[]) =>
  businesses.filter(b => !!b.id && ['owner', 'admin', 'editor'].includes(b.role));
export const validStaffStatus = (
  status: StaffStatus | null | undefined,
  actorId: string,
  companyId: string,
): status is StaffStatus =>
  !!status && status.actorId === actorId && status.companyId === companyId;
const validContext = (
  context: StaffContext | undefined,
  actorId: string,
): context is StaffContext =>
  !!context &&
  context.expectedActorId === actorId &&
  /^v1:[a-f0-9]{64}$/.test(context.authorityKey);
export function captureStaffCommand(
  kind: StaffCommand['kind'],
  status: StaffStatus | null | undefined,
  actorId: string,
  companyId: string,
  locale: string,
  id: () => string,
  enabled = true,
): StaffCommand | null {
  if (!validStaffStatus(status, actorId, companyId)) return null;
  const context = kind === 'configure' ? status.commandContext : status.staffContext;
  if (
    !validContext(context, actorId) ||
    (kind === 'configure'
      ? !status.canConfigure || (enabled && !status.available)
      : !status.available || !status.ready)
  )
    return null;
  const clientCommandId = id();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(clientCommandId)) throw new Error('Invalid command identity');
  const base = {
    companyId,
    clientCommandId,
    commandContext: Object.freeze({
      expectedActorId: actorId,
      authorityKey: context.authorityKey,
    }),
  };
  return Object.freeze(
    kind === 'configure'
      ? {
          ...base,
          kind,
          enabled,
          locale: locale === 'ar' || locale === 'fr' ? locale : 'en',
        }
      : { ...base, kind },
  );
}
export function staffCommandPayload(command: StaffCommand) {
  return JSON.stringify(
    command.kind === 'configure'
      ? [
          'staff-configure-v1',
          command.companyId,
          command.enabled,
          command.locale,
          command.commandContext.expectedActorId,
          command.commandContext.authorityKey,
        ]
      : [
          'staff-sync-v1',
          command.companyId,
          command.commandContext.expectedActorId,
          command.commandContext.authorityKey,
        ],
  );
}
export function staffWireCommand(
  command: StaffConfigureCommand,
): Omit<StaffConfigureCommand, 'kind'>;
export function staffWireCommand(command: StaffSyncCommand): Omit<StaffSyncCommand, 'kind'>;
export function staffWireCommand(
  command: StaffCommand,
): Omit<StaffConfigureCommand, 'kind'> | Omit<StaffSyncCommand, 'kind'>;
export function staffWireCommand(command: StaffCommand) {
  const { kind: _kind, ...wire } = command;
  return wire;
}
export const staffPendingQuery = (pending: StaffPending): StaffPendingQuery => ({
  kind: pending.command.kind === 'configure' ? 'tenant' : 'staff',
  clientCommandId: pending.command.clientCommandId,
  payloadHash: pending.hash,
});
export function staffCommandConfirmed(
  command: StaffCommand,
  hash: string,
  status: StaffStatus | null | undefined,
) {
  const proof = status?.confirmation;
  return (
    validStaffStatus(status, command.commandContext.expectedActorId, command.companyId) &&
    !!proof &&
    proof.actorId === command.commandContext.expectedActorId &&
    proof.companyId === command.companyId &&
    proof.kind === (command.kind === 'configure' ? 'tenant' : 'staff') &&
    proof.clientCommandId === command.clientCommandId &&
    proof.payloadHash === hash
  );
}
export function staffCommandCurrent(command: StaffCommand, status: StaffStatus | null | undefined) {
  return (
    validStaffStatus(status, command.commandContext.expectedActorId, command.companyId) &&
    command.commandContext.authorityKey ===
      (command.kind === 'configure' ? status.commandContext : status.staffContext)?.authorityKey
  );
}
export function staffCopy(locale: string) {
  return locale === 'ar'
    ? {
        title: 'إدارة صندوق الفريق',
        workspace: 'صندوق الفريق',
        workspaceSetupRequired:
          'أكمل إعداد صندوق الفريق واربط ملفك المؤكد من «إدارة صندوق الفريق» قبل فتحه.',
        workspaceSecuritySetup: 'أكمل إعداد أمان حساب الفريق في صندوق الويب قبل تسجيل الدخول.',
        restartSignIn: 'العودة لتسجيل الدخول بكلمة المرور',
        workspaceReconnect: 'تعذر تأكيد جلسة الفريق. سجّل الدخول بالحساب المرتبط في دزيري.',
        workspaceStorage: 'تعذر حفظ جلسة الفريق بأمان.',
        workspaceLogout: 'تم تسجيل الخروج محليًا. تعذر تأكيد إلغاء الجلسة على الخادم.',
        workspaceLogoutFailed: 'تعذر إكمال تسجيل الخروج بأمان. أعد المحاولة من إعدادات الحساب.',
        business: 'النشاط التجاري',
        choose: 'اختر نشاطًا تجاريًا',
        back: 'رجوع',
        loading: 'جارٍ التحميل…',
        unavailable: 'إعداد صندوق الفريق غير متاح حاليًا.',
        description: 'أدر وصول فريقك إلى رسائل الدعم من حساب دزيري نفسه.',
        setup: 'إعداد الصندوق',
        setupHint: 'أنشئ صندوق دعم لهذا النشاط التجاري. تبقى مشاركة كل محادثة بموافقة العميل.',
        ownerRequired: 'على مالك النشاط التجاري إعداد الصندوق أولًا.',
        waiting: 'طلبك محفوظ. في انتظار تأكيد الربط…',
        link: 'ربط ملفي بالفريق',
        linkHint: 'اربط اسمك وبريدك الإلكتروني المؤكد بصندوق هذا النشاط التجاري.',
        verify: 'أكد بريدك الإلكتروني في حساب دزيري قبل ربط ملفك بالفريق.',
        linked: 'ملفك مرتبط بصندوق الفريق',
        retry: 'إعادة المحاولة',
        failed: 'تعذر إكمال الطلب. يمكنك إعادة المحاولة بنفس الطلب.',
        review: 'تغير الوصول أو الإعداد. راجع الحالة قبل تقديم طلب جديد.',
        reviewAction: 'مراجعة الإعداد',
        stop: 'إيقاف الصندوق',
        stopTitle: 'هل تريد إيقاف صندوق هذا النشاط؟',
        stopHint: 'سيتوقف استقبال رسائل الدعم المشتركة. تبقى المحادثات الحالية في دزيري.',
        cancel: 'إلغاء',
        stopped: 'الصندوق متوقف',
        reviewHint: 'سيبدأ طلب جديد بالإعداد الحالي؛ يتطلب استئناف مشاركة المحادثات موافقة جديدة.',
        confirmSetup: 'تأكيد الإعداد',
        working: 'جارٍ حفظ الطلب…',
      }
    : locale === 'fr'
      ? {
          title: 'Gérer la messagerie d’équipe',
          workspace: 'Messagerie d’équipe',
          workspaceSetupRequired:
            'Terminez la configuration et liez votre profil vérifié dans « Gérer la messagerie d’équipe » avant de l’ouvrir.',
          workspaceSecuritySetup:
            'Terminez la configuration de sécurité du compte dans la messagerie web avant de vous connecter.',
          restartSignIn: 'Revenir à la connexion par mot de passe',
          workspaceReconnect:
            'La session d’équipe n’a pas pu être vérifiée. Connectez-vous avec le compte lié dans Dziri.',
          workspaceStorage: 'La session d’équipe n’a pas pu être enregistrée de façon sécurisée.',
          workspaceLogout:
            'Déconnexion locale effectuée. La révocation sur le serveur n’a pas pu être confirmée.',
          workspaceLogoutFailed:
            'La déconnexion sécurisée a échoué. Réessayez depuis les paramètres du compte.',
          business: 'Entreprise',
          choose: 'Choisir une entreprise',
          back: 'Retour',
          loading: 'Chargement…',
          unavailable: 'La configuration de la messagerie d’équipe est indisponible.',
          description: 'Gérez l’accès aux messages d’assistance avec votre compte Dziri.',
          setup: 'Configurer la messagerie',
          setupHint:
            'Créez une boîte d’assistance pour cette entreprise. Chaque conversation reste partagée avec le consentement du client.',
          ownerRequired: 'Le propriétaire doit d’abord configurer la messagerie.',
          waiting: 'Votre demande est enregistrée. En attente de confirmation…',
          link: 'Lier mon profil d’équipe',
          linkHint:
            'Associez votre nom et votre adresse e-mail vérifiée à la messagerie de cette entreprise.',
          verify: 'Vérifiez votre adresse e-mail dans Dziri avant de lier votre profil.',
          linked: 'Votre profil est lié à la messagerie d’équipe',
          retry: 'Réessayer',
          failed: 'La demande a échoué. Vous pouvez réessayer avec la même demande.',
          review:
            'L’accès ou la configuration a changé. Vérifiez la situation avant une nouvelle demande.',
          reviewAction: 'Vérifier la configuration',
          stop: 'Désactiver la messagerie',
          stopTitle: 'Désactiver la messagerie de cette entreprise ?',
          stopHint:
            'Votre équipe ne recevra plus les messages d’assistance partagés. Les conversations existantes restent dans Dziri.',
          cancel: 'Annuler',
          stopped: 'La messagerie est désactivée',
          reviewHint:
            'Une nouvelle demande utilisera la configuration actuelle. Le partage des conversations nécessitera un nouveau consentement.',
          confirmSetup: 'Confirmer la configuration',
          working: 'Enregistrement…',
        }
      : {
          title: 'Manage team inbox',
          workspace: 'Team inbox',
          workspaceSetupRequired:
            'Finish setup and link your verified profile in Manage team inbox before opening this workspace.',
          workspaceSecuritySetup:
            'Complete your staff security setup in the web inbox before signing in.',
          restartSignIn: 'Return to password sign-in',
          workspaceReconnect:
            'Your staff session could not be verified. Sign in with the account linked in Dziri.',
          workspaceStorage: 'Your staff session could not be saved securely.',
          workspaceLogout: 'Signed out locally. Server session revocation could not be confirmed.',
          workspaceLogoutFailed:
            'Secure sign out could not be completed. Try again from account settings.',
          business: 'Business',
          choose: 'Choose a business',
          back: 'Back',
          loading: 'Loading…',
          unavailable: 'Team inbox setup is currently unavailable.',
          description: 'Manage your team’s support access with your Dziri account.',
          setup: 'Set up inbox',
          setupHint:
            'Create a support inbox for this business. Each conversation is still shared with the customer’s consent.',
          ownerRequired: 'The business owner needs to set up the inbox first.',
          waiting: 'Your request is saved. Waiting for confirmation…',
          link: 'Link my staff profile',
          linkHint: 'Link your name and verified email address to this business’s inbox.',
          verify: 'Verify your email in Dziri before linking your staff profile.',
          linked: 'Your staff profile is linked',
          retry: 'Try again',
          failed: 'The request failed. You can retry the same request.',
          review: 'Access or setup changed. Review the current state before making a new request.',
          reviewAction: 'Review setup',
          stop: 'Turn off inbox',
          stopTitle: 'Turn off this business inbox?',
          stopHint:
            'Your team will stop receiving new shared support messages. Existing Dziri conversations remain.',
          cancel: 'Cancel',
          stopped: 'Inbox is turned off',
          reviewHint:
            'A new request will use the current setup. Resuming conversation sharing requires fresh consent.',
          confirmSetup: 'Confirm setup',
          working: 'Saving request…',
        };
}
