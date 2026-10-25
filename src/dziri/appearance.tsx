import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
const AppearanceContext = createContext({
  mode: null as boolean | null,
  setMode: (_dark: boolean | null) => {},
});
export function MessengerAppearance({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<boolean | null>(null);
  return (
    <AppearanceContext.Provider value={{ mode, setMode }}>{children}</AppearanceContext.Provider>
  );
}
export function useAppearance() {
  const context = useContext(AppearanceContext);
  const system = useColorScheme() === 'dark';
  return { dark: context.mode ?? system, setDark: context.setMode };
}
