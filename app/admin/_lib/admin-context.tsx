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
  deleteQuestion: (id: string) => void;
  // Maintenance
  resetAll: () => void;
  /** Questions belonging to a category, derived. */
  questionsFor: (categoryId: string) => AdminQuestion[];
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>({
    categories: [],
    questions: [],
  });
  const [ready, setReady] = useState(false);

  // Hydrate: localStorage first (instant), then Supabase (durable) on mount.
  useEffect(() => {
    setData(loadAdminData());
    setReady(true);
    void loadAdminDataRemote().then((remote) => {
      setData(remote);
    });
  }, []);

  // Persist to localStorage + Supabase on every change after hydration.
  useEffect(() => {
    if (ready) {
      saveAdminData(data);
      void saveAdminDataRemote(data);
    }
  }, [data, ready]);

  const addCategory = useCallback((input: Omit<AdminCategory, 'id'>) => {
    const cat: AdminCategory = { ...input, id: genId('cat') };
    setData((d) => ({ ...d, categories: [...d.categories, cat] }));
    return cat;
  }, []);

  const updateCategory = useCallback(
    (id: string, patch: Partial<AdminCategory>) => {
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
    setData((d) => ({
      categories: d.categories.filter((c) => c.id !== id),
      questions: d.questions.filter((q) => q.categoryId !== id),
    }));
  }, []);

  const addQuestion = useCallback((input: Omit<AdminQuestion, 'id'>) => {
    const q: AdminQuestion = { ...input, id: genId('q') };
    setData((d) => ({ ...d, questions: [...d.questions, q] }));
    return q;
  }, []);

  const updateQuestion = useCallback(
    (id: string, patch: Partial<AdminQuestion>) => {
      setData((d) => ({
        ...d,
        questions: d.questions.map((q) =>
          q.id === id ? { ...q, ...patch } : q
        ),
      }));
    },
    []
  );

  const deleteQuestion = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      questions: d.questions.filter((q) => q.id !== id),
    }));
  }, []);

  const resetAll = useCallback(() => {
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
      deleteQuestion,
      resetAll,
      questionsFor,
    }),
    [
      data,
      ready,
      addCategory,
      updateCategory,
      deleteCategory,
      addQuestion,
      updateQuestion,
      deleteQuestion,
      resetAll,
      questionsFor,
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
