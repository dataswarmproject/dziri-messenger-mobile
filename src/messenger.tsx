import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import CustomerApp from './dziri/app';
import TeamApp from './inbox/app';
import { LocaleProvider } from './dziri/locale';
import { colorsFor } from './dziri/theme';
import { supportLink } from './access';
import { EntryScreen } from './entry';

const colors = colorsFor(true);
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
});

export default function Messenger() {
  return (
    <LocaleProvider>
      <MessengerRuntime />
    </LocaleProvider>
  );
}

function MessengerRuntime() {
  const [view, setView] = useState<'customer' | 'team' | null>(null);
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
      setView('customer');
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
  // Changing views remounts the client/provider. Credentials never cross runtimes.
  if (view === 'customer')
    return <CustomerApp supportCompanyId={companyId} onExit={() => setView(null)} />;
  if (view === 'team') return <TeamApp onExit={() => setView(null)} />;
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.fill}>
        <EntryScreen choose={setView} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
