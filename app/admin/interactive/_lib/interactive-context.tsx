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
import type {
  InteractiveCategory,
  PluginConfig,
  PluginDataset,
  QRSession,
} from './types';
import {
  genId,
  loadInteractiveCategories,
  loadInteractiveCategoriesRemote,
  saveInteractiveCategories,
  saveInteractiveCategoriesRemote,
} from './store';
import {
  createSession as createQRSession,
  deleteSession,
  getAllSessions,
  initSessions,
  regenerateSession,
  revealSecret,
  tickSessions,
} from './qr-session-manager';

/**
 * Interactive Categories context. Exposes the category store + QR session
 * management. Components consume via `useInteractive()`. The store is
 * localStorage-backed; to sync with a real database later, replace the store
 * module internals — the context API stays stable.
 */

interface InteractiveContextValue {
  categories: InteractiveCategory[];
  sessions: QRSession[];
  ready: boolean;
  // Category CRUD
  addCategory: (input: Omit<InteractiveCategory, 'id'>) => InteractiveCategory;
  updateCategory: (id: string, patch: Partial<InteractiveCategory>) => void;
  deleteCategory: (id: string) => void;
  updateConfig: (id: string, config: PluginConfig) => void;
  updateDataset: (id: string, dataset: PluginDataset) => void;
  // QR sessions
  createSession: (input: {
    categoryId: string;
    secretContent: string;
    singleUse: boolean;
    expirationSeconds: number;
    connectionTimeoutSeconds: number;
  }) => QRSession;
  regenerateQR: (sessionId: string) => QRSession | null;
  getSession: (id: string) => QRSession | undefined;
  reveal: (id: string) => { ok: boolean; content?: string; reason?: string };
  removeSession: (id: string) => void;
}

const InteractiveContext = createContext<InteractiveContextValue | null>(null);

export function InteractiveProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<InteractiveCategory[]>([]);
  const [sessions, setSessions] = useState<QRSession[]>([]);
  const [ready, setReady] = useState(false);

  // Hydrate: localStorage first (instant), then Supabase (durable) on mount.
  useEffect(() => {
    setCategories(loadInteractiveCategories());
    initSessions();
    setSessions(getAllSessions());
    setReady(true);
    void loadInteractiveCategoriesRemote().then((remote) => {
      setCategories(remote);
    });
  }, []);

  // Persist categories to localStorage + Supabase on every change after hydration.
  useEffect(() => {
    if (ready) {
      saveInteractiveCategories(categories);
      void saveInteractiveCategoriesRemote(categories);
    }
  }, [categories, ready]);

  // Tick QR sessions every second to update statuses.
  useEffect(() => {
    if (!ready) return;
    const interval = window.setInterval(() => {
      const changed = tickSessions();
      if (changed.length) setSessions(getAllSessions());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [ready]);

  const addCategory = useCallback(
    (input: Omit<InteractiveCategory, 'id'>) => {
      const cat: InteractiveCategory = { ...input, id: genId('ic') };
      setCategories((prev) => [...prev, cat]);
      return cat;
    },
    []
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<InteractiveCategory>) => {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
    },
    []
  );

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateConfig = useCallback((id: string, config: PluginConfig) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, config } : c))
    );
  }, []);

  const updateDataset = useCallback((id: string, dataset: PluginDataset) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, dataset } : c))
    );
  }, []);

  const createSession = useCallback(
    (input: {
      categoryId: string;
      secretContent: string;
      singleUse: boolean;
      expirationSeconds: number;
      connectionTimeoutSeconds: number;
    }) => {
      const s = createQRSession(input);
      setSessions(getAllSessions());
      return s;
    },
    []
  );

  const regenerateQR = useCallback((sessionId: string) => {
    const next = regenerateSession(sessionId);
    setSessions(getAllSessions());
    return next;
  }, []);

  const getSession = useCallback(
    (id: string) => getAllSessions().find((s) => s.id === id),
    []
  );

  const reveal = useCallback((id: string) => {
    const result = revealSecret(id);
    setSessions(getAllSessions());
    return result;
  }, []);

  const removeSession = useCallback((id: string) => {
    deleteSession(id);
    setSessions(getAllSessions());
  }, []);

  const value = useMemo<InteractiveContextValue>(
    () => ({
      categories,
      sessions,
      ready,
      addCategory,
      updateCategory,
      deleteCategory,
      updateConfig,
      updateDataset,
      createSession,
      regenerateQR,
      getSession,
      reveal,
      removeSession,
    }),
    [
      categories,
      sessions,
      ready,
      addCategory,
      updateCategory,
      deleteCategory,
      updateConfig,
      updateDataset,
      createSession,
      regenerateQR,
      getSession,
      reveal,
      removeSession,
    ]
  );

  return (
    <InteractiveContext.Provider value={value}>
      {children}
    </InteractiveContext.Provider>
  );
}

export function useInteractive(): InteractiveContextValue {
  const ctx = useContext(InteractiveContext);
  if (!ctx)
    throw new Error('useInteractive must be used within InteractiveProvider');
  return ctx;
}
