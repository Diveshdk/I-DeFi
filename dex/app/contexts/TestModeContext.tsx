"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const STORAGE_KEY = "crossdex_test_mode";

type TestModeContextValue = {
  isTestMode: boolean;
  setTestMode: (on: boolean) => void;
};

const TestModeContext = createContext<TestModeContextValue | null>(null);

export function TestModeProvider({ children }: { children: ReactNode }) {
  const [isTestMode, setState] = useState(false);

  useEffect(() => {
    try {
      setState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  const setTestMode = useCallback((on: boolean) => {
    setState(on);
    try {
      if (on) localStorage.setItem(STORAGE_KEY, "1");
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  return (
    <TestModeContext.Provider value={{ isTestMode, setTestMode }}>
      {children}
    </TestModeContext.Provider>
  );
}

export function useTestMode() {
  const ctx = useContext(TestModeContext);
  return ctx ?? { isTestMode: false, setTestMode: () => {} };
}
