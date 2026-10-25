import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import Constants from 'expo-constants';
import CustomerApp from './dziri/app';
import TeamApp from './inbox/app';
import { LocaleProvider } from './dziri/locale';
import { supportLink } from './access';

export default function Messenger() {
  return (
    <LocaleProvider>
      <MessengerRuntime />
    </LocaleProvider>
  );
}

function MessengerRuntime() {
  const [companyId, setCompanyId] = useState<string>(
    process.env.EXPO_PUBLIC_SUPPORT_COMPANY_ID ??
      Constants.expoConfig?.extra?.supportCompanyId ??
      '',
  );
  useEffect(() => {
    let mounted = true;
    function open(value: string | null) {
      const target = supportLink(value);
      if (!mounted || !target) return;
      setCompanyId(target.companyId);
    }
    void Linking.getInitialURL()
      .then(open)
      .catch(() => {});
    const subscription = Linking.addEventListener('url', event => open(event.url));
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  // The root owns the separate staff client; personal code never imports its credentials.
  return (
    <CustomerApp
      supportCompanyId={companyId}
      renderTeam={userId => <TeamApp key={userId} identityScope={userId} />}
    />
  );
}
