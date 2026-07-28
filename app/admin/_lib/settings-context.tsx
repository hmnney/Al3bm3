'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AllSettings } from './settings-types';
import { loadSettings, resetSettings, saveSettings } from './settings-store';

/**
 * Settings context for the Game Management Center. Mirrors the pattern used by
 * the admin content context: hydrate from localStorage on mount, mirror into
 * React state, re-persist on every change.
 *
 * Components consume via `useSettings()`. The store is localStorage-backed; to
 * sync with a real database later, replace `settings-store.ts` internals —
 * the context API stays stable so no UI changes are needed.
 */

type SettingsUpdater = (patch: Partial<AllSettings>) => void;

interface SettingsContextValue {
  settings: AllSettings;
  ready: boolean;
  /** Shallow-merge a patch into the settings blob and persist. */
  update: SettingsUpdater;
  /** Restore defaults and persist. */
  resetAll: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AllSettings>(loadSettings());
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage once on mount (client-only).
  useEffect(() => {
    setSettings(loadSettings());
    setReady(true);
  }, []);

  // Persist on every change after hydration.
  useEffect(() => {
    if (ready) saveSettings(settings);
  }, [settings, ready]);

  const update = useCallback((patch: Partial<AllSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetAll = useCallback(() => {
    setSettings(resetSettings());
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, ready, update, resetAll }),
    [settings, ready, update, resetAll]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
