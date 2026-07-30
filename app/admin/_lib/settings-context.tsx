'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AllSettings } from './settings-types';
import { loadSettings, resetSettings, saveSettings, loadSettingsRemote, saveSettingsRemote } from './settings-store';
import type { StorageResult } from '@/lib/state-persistence';

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
  /** True when the last remote (Supabase) save failed. */
  remoteSaveError: boolean;
  /** Human-readable error message from the last remote save attempt. */
  remoteSaveErrorMessage: string | null;
  /** Manually retry the cloud sync with current settings. */
  retryRemoteSync: () => Promise<StorageResult>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AllSettings>(loadSettings());
  const [ready, setReady] = useState(false);

  // Race-condition guards: prevent the initial remote load from overwriting
  // local mutations, and prevent saving defaults to remote before the
  // initial remote load completes.
  const acceptRemote = useRef(true);
  const remoteLoaded = useRef(false);

  // Hydrate: localStorage first (instant), then Supabase (durable) on mount.
  useEffect(() => {
    console.log('[settings-context] hydrate START — loading from localStorage');
    setSettings(loadSettings());
    setReady(true);
    void loadSettingsRemote().then((result) => {
      console.log('[settings-context] loadSettingsRemote resolved — status:', result.status, 'acceptRemote:', acceptRemote.current, 'error:', result.error ?? '');
      if (acceptRemote.current && result.status === 'found' && result.data) {
        setSettings(result.data);
      }
      remoteLoaded.current = true;
      console.log('[settings-context] remoteLoaded = true');
    });
  }, []);

  const [remoteSaveError, setRemoteSaveError] = useState(false);
  const [remoteSaveErrorMessage, setRemoteSaveErrorMessage] = useState<string | null>(null);

  const doRemoteSave = useCallback(async (currentSettings: AllSettings): Promise<StorageResult> => {
    console.log('[settings-context] saveSettingsRemote START');
    const result = await saveSettingsRemote(currentSettings);
    console.log('[settings-context] saveSettingsRemote END — result:', result);
    if (result.ok) {
      setRemoteSaveError(false);
      setRemoteSaveErrorMessage(null);
    } else {
      setRemoteSaveError(true);
      setRemoteSaveErrorMessage(result.error ?? 'Unknown error');
      console.error('[settings-context] REMOTE SAVE FAILED:', result.error);
    }
    return result;
  }, []);

  const retryRemoteSync = useCallback(async (): Promise<StorageResult> => {
    return doRemoteSave(settings);
  }, [settings, doRemoteSave]);

  // Persist to localStorage + Supabase on every change after hydration.
  // Don't save to remote until the initial remote load completes —
  // otherwise we overwrite durable data with defaults.
  useEffect(() => {
    if (!ready) return;
    saveSettings(settings);
    if (!remoteLoaded.current) return;
    void doRemoteSave(settings);
  }, [settings, ready, doRemoteSave]);

  const update = useCallback((patch: Partial<AllSettings>) => {
    acceptRemote.current = false;
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetAll = useCallback(() => {
    acceptRemote.current = false;
    setSettings(resetSettings());
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, ready, update, resetAll, remoteSaveError, remoteSaveErrorMessage, retryRemoteSync }),
    [settings, ready, update, resetAll, remoteSaveError, remoteSaveErrorMessage, retryRemoteSync]
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
