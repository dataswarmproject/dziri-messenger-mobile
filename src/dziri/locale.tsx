import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { getLocales } from 'expo-localization';

const en = {
  app: 'Dziri Messenger',
  signIn: 'Sign in',
  email: 'Email',
  password: 'Password',
  loginHint: 'Use your existing Dziri account',
  loginFailed: 'Unable to sign in. Check your details and connection.',
  chats: 'Chats',
  signOut: 'Sign out',
  empty: 'No conversations yet.',
  loading: 'Loading…',
  send: 'Send',
  message: 'Message',
  sent: 'Stored',
  seen: 'Seen',
  sendFailed: 'Message was not confirmed. Your draft is kept; retry to confirm it.',
  unavailable: 'This conversation is unavailable.',
  readonly: 'Sending is unavailable in this conversation.',
  encryptionUnavailable:
    'This conversation needs encryption support that is not available in this build.',
  deleted: 'Message deleted',
  unsupported: 'This message type is not supported in this build.',
  config: 'Messenger is not configured',
  configHint: 'Please try again later.',
  connection: 'Connecting…',
  older: 'Load older messages',
  failed: 'Unable to load Messenger.',
  retry: 'Try again',
  unknown: 'Conversation',
  noProfile: 'Your Dziri profile is unavailable.',
};
const fr: typeof en = {
  app: 'Dziri Messenger',
  signIn: 'Se connecter',
  email: 'E-mail',
  password: 'Mot de passe',
  loginHint: 'Utilisez votre compte Dziri existant',
  loginFailed: 'Connexion impossible. Vérifiez vos identifiants et votre connexion.',
  chats: 'Discussions',
  signOut: 'Se déconnecter',
  empty: 'Aucune discussion pour le moment.',
  loading: 'Chargement…',
  send: 'Envoyer',
  message: 'Message',
  sent: 'Enregistré',
  seen: 'Vu',
  sendFailed: 'Envoi non confirmé. Votre brouillon est conservé ; réessayez.',
  unavailable: 'Cette discussion est indisponible.',
  readonly: 'Envoi indisponible dans cette discussion.',
  encryptionUnavailable:
    'Cette discussion nécessite un chiffrement indisponible dans cette version.',
  deleted: 'Message supprimé',
  unsupported: 'Ce type de message est indisponible dans cette version.',
  config: 'Messenger non configuré',
  configHint: 'Veuillez réessayer plus tard.',
  connection: 'Connexion…',
  older: 'Messages précédents',
  failed: 'Impossible de charger Messenger.',
  retry: 'Réessayer',
  unknown: 'Discussion',
  noProfile: 'Votre profil Dziri est indisponible.',
};
const ar: typeof en = {
  app: 'دزيري ماسنجر',
  signIn: 'تسجيل الدخول',
  email: 'البريد الإلكتروني',
  password: 'كلمة المرور',
  loginHint: 'استخدم حساب دزيري الحالي',
  loginFailed: 'تعذر تسجيل الدخول. تحقق من بياناتك واتصالك.',
  chats: 'المحادثات',
  signOut: 'تسجيل الخروج',
  empty: 'لا توجد محادثات بعد.',
  loading: 'جارٍ التحميل…',
  send: 'إرسال',
  message: 'رسالة',
  sent: 'تم الحفظ',
  seen: 'تمت المشاهدة',
  sendFailed: 'لم يتم تأكيد الإرسال. تم الاحتفاظ بالمسودة؛ أعد المحاولة للتأكيد.',
  unavailable: 'هذه المحادثة غير متاحة.',
  readonly: 'الإرسال غير متاح في هذه المحادثة.',
  encryptionUnavailable: 'تحتاج هذه المحادثة إلى دعم تشفير غير متاح في هذا الإصدار.',
  deleted: 'تم حذف الرسالة',
  unsupported: 'هذا النوع من الرسائل غير مدعوم في هذا الإصدار.',
  config: 'ماسنجر غير مهيأ',
  configHint: 'يرجى المحاولة لاحقاً.',
  connection: 'جارٍ الاتصال…',
  older: 'تحميل الرسائل السابقة',
  failed: 'تعذر تحميل ماسنجر.',
  retry: 'إعادة المحاولة',
  unknown: 'محادثة',
  noProfile: 'ملفك الشخصي في دزيري غير متاح.',
};
const dictionaries = { en, fr, ar };
export type Locale = keyof typeof dictionaries;
const LocaleContext = createContext({
  locale: 'en' as Locale,
  setLocale: (_value: Locale) => {},
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    const language = getLocales()[0]?.languageCode;
    return language === 'ar' || language === 'fr' ? language : 'en';
  });
  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  return { ...context, t: dictionaries[context.locale], rtl: context.locale === 'ar' };
}
