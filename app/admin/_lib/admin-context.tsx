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
  deleteCategoryRemote,
  deleteQuestionRemote,
  genId,
  loadAdminData,
  loadAdminDataRemote,
  saveAdminData,
  saveCategoryRemote,
  saveQuestionRemote,
  saveQuestionsRemote,
} from './store';
import { CATEGORIES } from '@/lib/constants';
import { toAdminCategory } from './types';

/**
 * Admin data context — the SINGLE source of truth for the question bank.
 *
 * Each question and category is its own row in Supabase (admin_questions,
 * admin_categories). A mutation only touches the ONE row that changed, so
 * two devices editing different questions at the same time can never
 * overwrite each other. Loading fetches all rows from both tables, which is
 * automatically the correct merged picture.
 *
 * Startup:
 *   1. Paint instantly from localStorage (so the UI is never blank).
 *   2. Fetch all rows from Supabase.
 *   3. Replace React state + localStorage with the Supabase data.
 *
 * Mutations:
 *   a. Update local React state immediately (optimistic UI).
 *   b. Fire the per-row remote call for the ONE item that changed.
 *   c. On error, set remoteSaveError so the UI can surface a retry banner.
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
  addQuestionsBulk: (inputs: Omit<AdminQuestion, 'id'>[]) => AdminQuestion[];
  updateQuestion: (id: string, patch: Partial<AdminQuestion>) => void;
  updateQuestionByText: (
    questionText: string,
    patch: Partial<AdminQuestion>
  ) => boolean;
  deleteQuestion: (id: string) => void;
  /** Replace the entire dataset (used by AI generator). */
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
  /** Commit the batch — push buffered rows then re-fetch. */
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

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // ─── Startup: localStorage (instant) → Supabase (truth) ──────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = loadAdminData();
      if (!cancelled) {
        setData(local);
        setReady(true);
      }
      const result = await loadAdminDataRemote();
      if (cancelled) return;
      if (result.status === 'found' && result.data) {
        setData(result.data);
        dataRef.current = result.data;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Remote error helper ─────────────────────────────────────────────
  const handleRemoteError = useCallback((result: StorageResult) => {
    if (!result.ok) {
      setRemoteSaveError(true);
      setRemoteSaveErrorMessage(result.error ?? 'Unknown error');
    } else {
      setRemoteSaveError(false);
      setRemoteSaveErrorMessage(null);
    }
  }, []);

  // ─── Batching (Excel import) ─────────────────────────────────────────
  // While batching is active, addQuestion/addQuestionsBulk buffer their new
  // rows in a ref instead of saving one-by-one. commitBatch() flushes them in
  // a single upsert, then re-fetches to refresh local state.
  const batchingRef = useRef(false);
  const batchedQuestionsRef = useRef<AdminQuestion[]>([]);
  const batchedCategoriesRef = useRef<AdminCategory[]>([]);

  const beginBatch = useCallback(() => {
    batchingRef.current = true;
    batchedQuestionsRef.current = [];
    batchedCategoriesRef.current = [];
  }, []);

  const commitBatch = useCallback(async (): Promise<StorageResult> => {
    batchingRef.current = false;
    setSyncing(true);
    const cats = batchedCategoriesRef.current;
    const qs = batchedQuestionsRef.current;
    batchedQuestionsRef.current = [];
    batchedCategoriesRef.current = [];

    const results: StorageResult[] = [];
    // Save categories one by one (usually just 1-3 new categories per import).
    for (const cat of cats) {
      results.push(await saveCategoryRemote(cat));
    }
    // Save all questions in one bulk upsert.
    if (qs.length > 0) results.push(await saveQuestionsRemote(qs));

    const failed = results.find((r) => !r.ok);
    if (failed) {
      handleRemoteError(failed);
      setSyncing(false);
      return failed;
    }

    // Re-fetch to refresh local state with the merged picture.
    const loadRes = await loadAdminDataRemote();
    if (loadRes.status === 'found' && loadRes.data) {
      setData(loadRes.data);
      dataRef.current = loadRes.data;
    }
    setRemoteSaveError(false);
    setRemoteSaveErrorMessage(null);
    setSyncing(false);
    return { ok: true };
  }, [handleRemoteError]);

  // ─── retryRemoteSync ─────────────────────────────────────────────────
  // Re-saves all current data (used by the import page's retry button when a
  // previous save failed). For the per-row model this means re-upserting all
  // categories and questions, which is safe because upsert is idempotent.
  const retryRemoteSync = useCallback(async (): Promise<StorageResult> => {
    setSyncing(true);
    const current = dataRef.current;
    const qRes = await saveQuestionsRemote(current.questions);
    if (!qRes.ok) {
      handleRemoteError(qRes);
      setSyncing(false);
      return qRes;
    }
    // Categories saved one-by-one (small count).
    for (const cat of current.categories) {
      const r = await saveCategoryRemote(cat);
      if (!r.ok) {
        handleRemoteError(r);
        setSyncing(false);
        return r;
      }
    }
    const loadRes = await loadAdminDataRemote();
    if (loadRes.status === 'found' && loadRes.data) {
      setData(loadRes.data);
      dataRef.current = loadRes.data;
    }
    setRemoteSaveError(false);
    setRemoteSaveErrorMessage(null);
    setSyncing(false);
    return { ok: true };
  }, [handleRemoteError]);

  // ─── Local state updater (optimistic) ─────────────────────────────────
  const updateLocal = useCallback((producer: (current: AdminData) => AdminData) => {
    const next = producer(dataRef.current);
    setData(next);
    dataRef.current = next;
  }, []);

  // ─── Category CRUD ───────────────────────────────────────────────────
  const addCategory = useCallback(
    (input: Omit<AdminCategory, 'id'>) => {
      const cat: AdminCategory = { ...input, id: genId('cat') };
      updateLocal((d) => ({ ...d, categories: [...d.categories, cat] }));
      if (batchingRef.current) {
        batchedCategoriesRef.current.push(cat);
      } else {
        void saveCategoryRemote(cat).then(handleRemoteError);
      }
      return cat;
    },
    [updateLocal, handleRemoteError]
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<AdminCategory>) => {
      let updated: AdminCategory | null = null;
      updateLocal((d) => ({
        ...d,
        categories: d.categories.map((c) => {
          if (c.id === id) {
            updated = { ...c, ...patch };
            return updated;
          }
          return c;
        }),
      }));
      if (updated && !batchingRef.current) {
        void saveCategoryRemote(updated).then(handleRemoteError);
      }
    },
    [updateLocal, handleRemoteError]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      updateLocal((d) => ({
        categories: d.categories.filter((c) => c.id !== id),
        questions: d.questions.filter((q) => q.categoryId !== id),
      }));
      if (!batchingRef.current) {
        void deleteCategoryRemote(id).then(handleRemoteError);
        // Also delete orphaned questions on the remote.
        dataRef.current.questions
          .filter((q) => q.categoryId === id)
          .forEach((q) => void deleteQuestionRemote(q.id));
      }
    },
    [updateLocal, handleRemoteError]
  );

  // ─── Question CRUD ───────────────────────────────────────────────────
  const addQuestion = useCallback(
    (input: Omit<AdminQuestion, 'id'>) => {
      const q: AdminQuestion = { ...input, id: genId('q') };
      updateLocal((d) => ({ ...d, questions: [...d.questions, q] }));
      if (batchingRef.current) {
        batchedQuestionsRef.current.push(q);
      } else {
        void saveQuestionRemote(q).then(handleRemoteError);
      }
      return q;
    },
    [updateLocal, handleRemoteError]
  );

  const addQuestionsBulk = useCallback(
    (inputs: Omit<AdminQuestion, 'id'>[]) => {
      const newQs: AdminQuestion[] = inputs.map((input) => ({
        ...input,
        id: genId('q'),
      }));
      updateLocal((d) => ({ ...d, questions: [...d.questions, ...newQs] }));
      if (batchingRef.current) {
        batchedQuestionsRef.current.push(...newQs);
      } else {
        void saveQuestionsRemote(newQs).then(handleRemoteError);
      }
      return newQs;
    },
    [updateLocal, handleRemoteError]
  );

  const updateQuestion = useCallback(
    (id: string, patch: Partial<AdminQuestion>) => {
      let updated: AdminQuestion | null = null;
      updateLocal((d) => ({
        ...d,
        questions: d.questions.map((q) => {
          if (q.id === id) {
            updated = { ...q, ...patch };
            return updated;
          }
          return q;
        }),
      }));
      if (updated && !batchingRef.current) {
        void saveQuestionRemote(updated).then(handleRemoteError);
      }
    },
    [updateLocal, handleRemoteError]
  );

  const updateQuestionByText = useCallback(
    (questionText: string, patch: Partial<AdminQuestion>) => {
      const normalized = questionText.trim().toLowerCase();
      let updated: AdminQuestion | null = null;
      let found = false;
      updateLocal((d) => ({
        ...d,
        questions: d.questions.map((q) => {
          if (!found && q.question.trim().toLowerCase() === normalized) {
            found = true;
            updated = { ...q, ...patch };
            return updated;
          }
          return q;
        }),
      }));
      if (updated && found && !batchingRef.current) {
        void saveQuestionRemote(updated).then(handleRemoteError);
      }
      return found;
    },
    [updateLocal, handleRemoteError]
  );

  const deleteQuestion = useCallback(
    (id: string) => {
      updateLocal((d) => ({
        ...d,
        questions: d.questions.filter((q) => q.id !== id),
      }));
      if (!batchingRef.current) {
        void deleteQuestionRemote(id).then(handleRemoteError);
      }
    },
    [updateLocal, handleRemoteError]
  );

  const replaceAll = useCallback(
    (next: AdminData) => {
      updateLocal(() => next);
      if (!batchingRef.current) {
        setSyncing(true);
        void (async () => {
          // For replaceAll, save all items to per-row tables.
          const catResults: StorageResult[] = [];
          for (const cat of next.categories) {
            catResults.push(await saveCategoryRemote(cat));
          }
          const qRes = await saveQuestionsRemote(next.questions);
          const failed = catResults.find((r) => !r.ok) ?? (qRes.ok ? null : qRes);
          if (failed) {
            handleRemoteError(failed);
          } else {
            const loadRes = await loadAdminDataRemote();
            if (loadRes.status === 'found' && loadRes.data) {
              setData(loadRes.data);
              dataRef.current = loadRes.data;
            }
            setRemoteSaveError(false);
            setRemoteSaveErrorMessage(null);
          }
          setSyncing(false);
        })();
      }
    },
    [updateLocal, handleRemoteError]
  );

  const resetAll = useCallback(() => {
    const fresh = seed();
    updateLocal(() => fresh);
    if (!batchingRef.current) {
      setSyncing(true);
      void (async () => {
        // Delete all existing rows, then save the seed categories.
        const current = dataRef.current;
        for (const q of current.questions) {
          await deleteQuestionRemote(q.id);
        }
        for (const cat of current.categories) {
          await deleteCategoryRemote(cat.id);
        }
        for (const cat of fresh.categories) {
          await saveCategoryRemote(cat);
        }
        const loadRes = await loadAdminDataRemote();
        if (loadRes.status === 'found' && loadRes.data) {
          setData(loadRes.data);
          dataRef.current = loadRes.data;
        } else {
          saveAdminData(fresh);
        }
        setRemoteSaveError(false);
        setRemoteSaveErrorMessage(null);
        setSyncing(false);
      })();
    }
  }, [updateLocal]);

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
      addQuestionsBulk,
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
      addQuestionsBulk,
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
