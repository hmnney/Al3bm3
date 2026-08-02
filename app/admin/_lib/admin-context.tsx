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
  saveAdminData,
  saveAdminDataRemote,
} from './store';
import { CATEGORIES } from '@/lib/constants';
import { toAdminCategory } from './types';

/**
 * Admin data context — the SINGLE source of truth for the question bank.
 *
 * Supabase is the only source of truth. localStorage is an offline cache.
 *
 * Startup:
 *   1. Paint instantly from localStorage (so the UI is never blank).
 *   2. Fetch the latest from Supabase.
 *   3. Replace React state + localStorage with the Supabase data.
 *
 * Every mutation (add / edit / delete / import / reset / edit category):
 *   A. Save the new dataset to Supabase and WAIT for success.
 *   B. Re-fetch the latest data from Supabase.
 *   C. Replace React state with the fresh Supabase data.
 *   D. Replace localStorage with the fresh Supabase data.
 *
 * No in-memory copy survives a save — state always converges to what Supabase
 * holds, so two devices can never end up with different question counts.
 */

interface AdminContextValue {
  data: AdminData;
  ready: boolean;
  syncing: boolean;
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
  /** Replace the entire dataset (used by Excel import / AI generator). */
  replaceAll: (next: AdminData) => void;
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
  /** Begin a batch — mutations update state but defer the remote sync. */
  beginBatch: () => void;
  /** Commit the batch — one save → re-fetch → replace cycle. */
  commitBatch: () => Promise<StorageResult>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

function seed(): AdminData {
  const categories: AdminCategory[] = CATEGORIES.map(toAdminCategory);
  return { categories, questions: [] };
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>({
    categories: [],
    questions: [],
  });
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [remoteSaveError, setRemoteSaveError] = useState(false);
  const [remoteSaveErrorMessage, setRemoteSaveErrorMessage] = useState<string | null>(null);

  // Always-current snapshot for computing mutations outside of render.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // ─── Startup: localStorage (instant) → Supabase (truth) ──────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = loadAdminData();
      console.log('[admin-context] Loaded from localStorage: Question count =', local.questions.length);
      if (!cancelled) {
        setData(local);
        setReady(true);
        console.log('[admin-context] Rendering from Local — Question count =', local.questions.length);
      }
      const result = await loadAdminDataRemote();
      if (cancelled) return;
      console.log('[admin-context] loadAdminDataRemote — status:', result.status, 'error:', result.error ?? '');
      if (result.status === 'found' && result.data) {
        console.log('[admin-context] Loaded from Supabase: Question count =', result.data.questions.length);
        setData(result.data);
        dataRef.current = result.data;
        console.log('[admin-context] Rendering from Supabase — Question count =', result.data.questions.length);
      } else {
        console.log('[admin-context] Rendering from Local — Question count =', local.questions.length, '(remote status:', result.status + ')');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Single save path: save → wait → re-fetch → replace ──────────────
  const syncToRemote = useCallback(async (next: AdminData): Promise<StorageResult> => {
    setSyncing(true);
    console.log('[admin-context] SAVE START — Question count =', next.questions.length);
    // A) Save to Supabase and WAIT.
    const saveRes = await saveAdminDataRemote(next);
    console.log('[admin-context] SAVE END — ok:', saveRes.ok, 'error:', saveRes.error ?? '');
    if (!saveRes.ok) {
      setRemoteSaveError(true);
      setRemoteSaveErrorMessage(saveRes.error ?? 'Unknown error');
      setSyncing(false);
      return saveRes;
    }
    // B) Re-fetch the latest from Supabase.
    const loadRes = await loadAdminDataRemote();
    if (loadRes.status === 'found' && loadRes.data) {
      // C) Replace React state. D) Replace localStorage (loadAdminDataRemote writes cache).
      setData(loadRes.data);
      dataRef.current = loadRes.data;
      console.log('[admin-context] Re-fetched from Supabase — Question count =', loadRes.data.questions.length);
    } else {
      // Save succeeded but re-fetch failed — keep the saved data as truth.
      saveAdminData(next);
      dataRef.current = next;
    }
    setRemoteSaveError(false);
    setRemoteSaveErrorMessage(null);
    setSyncing(false);
    return saveRes;
  }, []);

  // Batching: when active, mutations update state but defer the remote sync
  // until commitBatch() fires one save → re-fetch → replace cycle. Essential
  // for Excel import (hundreds of addQuestion calls).
  const batchingRef = useRef(false);
  const beginBatch = useCallback(() => {
    batchingRef.current = true;
  }, []);
  const commitBatch = useCallback(async (): Promise<StorageResult> => {
    batchingRef.current = false;
    return syncToRemote(dataRef.current);
  }, [syncToRemote]);

  // Helper: compute next state from the latest snapshot, apply optimistically,
  // then sync to Supabase (save → re-fetch → replace).
  const mutate = useCallback(
    (producer: (current: AdminData) => AdminData) => {
      const next = producer(dataRef.current);
      setData(next);
      dataRef.current = next;
      if (!batchingRef.current) void syncToRemote(next);
    },
    [syncToRemote]
  );

  const retryRemoteSync = useCallback(async (): Promise<StorageResult> => {
    return syncToRemote(dataRef.current);
  }, [syncToRemote]);

  // ─── Category CRUD ───────────────────────────────────────────────────
  const addCategory = useCallback(
    (input: Omit<AdminCategory, 'id'>) => {
      const cat: AdminCategory = { ...input, id: genId('cat') };
      mutate((d) => ({ ...d, categories: [...d.categories, cat] }));
      return cat;
    },
    [mutate]
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<AdminCategory>) => {
      mutate((d) => ({
        ...d,
        categories: d.categories.map((c) =>
          c.id === id ? { ...c, ...patch } : c
        ),
      }));
    },
    [mutate]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      mutate((d) => ({
        categories: d.categories.filter((c) => c.id !== id),
        questions: d.questions.filter((q) => q.categoryId !== id),
      }));
    },
    [mutate]
  );

  // ─── Question CRUD ───────────────────────────────────────────────────
  const addQuestion = useCallback(
    (input: Omit<AdminQuestion, 'id'>) => {
      const q: AdminQuestion = { ...input, id: genId('q') };
      mutate((d) => ({ ...d, questions: [...d.questions, q] }));
      return q;
    },
    [mutate]
  );

  const updateQuestion = useCallback(
    (id: string, patch: Partial<AdminQuestion>) => {
      mutate((d) => ({
        ...d,
        questions: d.questions.map((q) =>
          q.id === id ? { ...q, ...patch } : q
        ),
      }));
    },
    [mutate]
  );

  const updateQuestionByText = useCallback(
    (questionText: string, patch: Partial<AdminQuestion>) => {
      const normalized = questionText.trim().toLowerCase();
      let found = false;
      mutate((d) => ({
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
    [mutate]
  );

  const deleteQuestion = useCallback(
    (id: string) => {
      mutate((d) => ({
        ...d,
        questions: d.questions.filter((q) => q.id !== id),
      }));
    },
    [mutate]
  );

  const replaceAll = useCallback(
    (next: AdminData) => {
      mutate(() => next);
    },
    [mutate]
  );

  const resetAll = useCallback(() => {
    mutate(() => seed());
  }, [mutate]);

  const questionsFor = useCallback(
    (categoryId: string) => data.questions.filter((q) => q.categoryId === categoryId),
    [data.questions]
  );

  const value = useMemo<AdminContextValue>(
    () => ({
      data,
      ready,
      syncing,
      addCategory,
      updateCategory,
      deleteCategory,
      addQuestion,
      updateQuestion,
      updateQuestionByText,
      deleteQuestion,
      replaceAll,
      resetAll,
      questionsFor,
      remoteSaveError,
      remoteSaveErrorMessage,
      retryRemoteSync,
      beginBatch,
      commitBatch,
    }),
    [
      data,
      ready,
      syncing,
      addCategory,
      updateCategory,
      deleteCategory,
      addQuestion,
      updateQuestion,
      updateQuestionByText,
      deleteQuestion,
      replaceAll,
      resetAll,
      questionsFor,
      remoteSaveError,
      remoteSaveErrorMessage,
      retryRemoteSync,
      beginBatch,
      commitBatch,
    ]
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within an AdminProvider');
  return ctx;
}
