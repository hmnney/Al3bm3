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
import type { StorageResult } from '@/lib/state-persistence';
import type { AdminCategory, AdminData, AdminQuestion } from './types';
import {
  genId,
  loadAdminData,
  loadAdminDataRemote,
  resetAdminData,
  saveAdminData,
  saveAdminDataRemote,
} from './store';

/**
 * Admin data context. Exposes the local dataset plus CRUD actions. Components
 * consume via `useAdmin()`. The store is localStorage-backed; the context just
 * mirrors it into React state and re-persists on every change.
 */

interface AdminContextValue {
  data: AdminData;
  ready: boolean;
  // Category CRUD
  addCategory: (input: Omit<AdminCategory, 'id'>) => AdminCategory;
  updateCategory: (id: string, patch: Partial<AdminCategory>) => void;
  deleteCategory: (id: string) => void;
  // Question CRUD
  addQuestion: (input: Omit<AdminQuestion, 'id'>) => AdminQuestion;
  updateQuestion: (id: string, patch: Partial<AdminQuestion>) => void;
  updateQuestionByText: (
    questionText: string,
    patch: Partial<AdminQuestion>
  ) => boolean;
  deleteQuestion: (id: string) => void;
  // Maintenance
  resetAll: () => void;
  /** Questions belonging to a category, derived. */
  questionsFor: (categoryId: string) => AdminQuestion[];
  /** True when the last remote (Supabase) save failed. */
  remoteSaveError: boolean;
  /** Human-readable error message from the last remote save attempt. */
  remoteSaveErrorMessage: string | null;
  /** Manually retry the cloud sync with current data. */
  retryRemoteSync: () => Promise<StorageResult>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>({
    categories: [],
    questions: [],
  });
  const [ready, setReady] = useState(false);

  // Race-condition guards: prevent the initial remote load from overwriting
  // local mutations, and prevent saving defaults to remote before the
  // initial remote load completes.
  const acceptRemote = useRef(true);
  const remoteLoaded = useRef(false);

  // Hydrate: localStorage first (instant), then Supabase (durable) on mount.
  useEffect(() => {
    console.log('[admin-context] hydrate START — loading from localStorage');
    setData(loadAdminData());
    setReady(true);
    void loadAdminDataRemote().then((result) => {
      console.log('[admin-context] loadAdminDataRemote resolved — status:', result.status, 'acceptRemote:', acceptRemote.current, 'error:', result.error ?? '');
      if (acceptRemote.current && result.status === 'found' && result.data) {
        setData(result.data);
      }
      remoteLoaded.current = true;
      console.log('[admin-context] remoteLoaded = true');
    });
  }, []);

  // Persist to localStorage synchronously (fast) and Supabase remotely
  // (debounced so a burst of setData calls — e.g. during Smart Import —
  // doesn't flood the network with one upload per question).
  const remoteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [remoteSaveError, setRemoteSaveError] = useState(false);
  const [remoteSaveErrorMessage, setRemoteSaveErrorMessage] = useState<string | null>(null);

  const doRemoteSave = useCallback(async (currentData: AdminData): Promise<StorageResult> => {
    console.log('[admin-context] saveAdminDataRemote START');
    const result = await saveAdminDataRemote(currentData);
    console.log('[admin-context] saveAdminDataRemote END — result:', result);
    if (result.ok) {
      setRemoteSaveError(false);
      setRemoteSaveErrorMessage(null);
    } else {
      setRemoteSaveError(true);
      setRemoteSaveErrorMessage(result.error ?? 'Unknown error');
      console.error('[admin-context] REMOTE SAVE FAILED:', result.error);
    }
    return result;
  }, []);

  const retryRemoteSync = useCallback(async (): Promise<StorageResult> => {
    return doRemoteSave(data);
  }, [data, doRemoteSave]);

  useEffect(() => {
    if (!ready) return;
    saveAdminData(data);

    // Don't save to remote until the initial remote load completes —
    // otherwise we overwrite durable data with seed/defaults.
    if (!remoteLoaded.current) return;

    if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    remoteSaveTimer.current = setTimeout(() => {
      void doRemoteSave(data);
    }, 1500);
  }, [data, ready, doRemoteSave]);

  const addCategory = useCallback((input: Omit<AdminCategory, 'id'>) => {
    acceptRemote.current = false;
    const cat: AdminCategory = { ...input, id: genId('cat') };
    setData((d) => ({ ...d, categories: [...d.categories, cat] }));
    return cat;
  }, []);

  const updateCategory = useCallback(
    (id: string, patch: Partial<AdminCategory>) => {
      acceptRemote.current = false;
      setData((d) => ({
        ...d,
        categories: d.categories.map((c) =>
          c.id === id ? { ...c, ...patch } : c
        ),
      }));
    },
    []
  );

  const deleteCategory = useCallback((id: string) => {
    acceptRemote.current = false;
    setData((d) => ({
      categories: d.categories.filter((c) => c.id !== id),
      questions: d.questions.filter((q) => q.categoryId !== id),
    }));
  }, []);

  const addQuestion = useCallback((input: Omit<AdminQuestion, 'id'>) => {
    acceptRemote.current = false;
    const q: AdminQuestion = { ...input, id: genId('q') };
    setData((d) => ({ ...d, questions: [...d.questions, q] }));
    return q;
  }, []);

  const updateQuestion = useCallback(
    (id: string, patch: Partial<AdminQuestion>) => {
      acceptRemote.current = false;
      setData((d) => ({
        ...d,
        questions: d.questions.map((q) =>
          q.id === id ? { ...q, ...patch } : q
        ),
      }));
    },
    []
  );

  const updateQuestionByText = useCallback(
    (questionText: string, patch: Partial<AdminQuestion>) => {
      const normalized = questionText.trim().toLowerCase();
      let found = false;
      acceptRemote.current = false;
      setData((d) => ({
        ...d,
        questions: d.questions.map((q) => {
          if (!found && q.question.trim().toLowerCase() === normalized) {
            found = true;
            return { ...q, ...patch };
          }
          return q;
        }),
      }));
      return found;
    },
    []
  );

  const deleteQuestion = useCallback((id: string) => {
    acceptRemote.current = false;
    setData((d) => ({
      ...d,
      questions: d.questions.filter((q) => q.id !== id),
    }));
  }, []);

  const resetAll = useCallback(() => {
    acceptRemote.current = false;
    setData(resetAdminData());
  }, []);

  const questionsFor = useCallback(
    (categoryId: string) => data.questions.filter((q) => q.categoryId === categoryId),
    [data.questions]
  );

  const value = useMemo<AdminContextValue>(
    () => ({
      data,
      ready,
      addCategory,
      updateCategory,
      deleteCategory,
      addQuestion,
      updateQuestion,
      updateQuestionByText,
      deleteQuestion,
      resetAll,
      questionsFor,
      remoteSaveError,
      remoteSaveErrorMessage,
      retryRemoteSync,
    }),
    [
      data,
      ready,
      addCategory,
      updateCategory,
      deleteCategory,
      addQuestion,
      updateQuestion,
      updateQuestionByText,
      deleteQuestion,
      resetAll,
      questionsFor,
      remoteSaveError,
      remoteSaveErrorMessage,
      retryRemoteSync,
    ]
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
