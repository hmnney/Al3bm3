import { CATEGORIES } from '@/lib/constants';
import type { AdminCategory, AdminData, AdminQuestion } from './types';
import { toAdminCategory } from './types';
import {
  deleteRow,
  listRows,
  readCache,
  upsertRow,
  upsertRows,
  writeCache,
  type StorageResult,
  type LoadResult,
} from '@/lib/state-persistence';

/**
 * Admin data store. The question bank is persisted as one row per item in
 * Supabase (admin_questions + admin_categories tables) so that two devices
 * editing different questions at the same time can never overwrite each
 * other. localStorage is an offline cache for instant hydration.
 */

const STORAGE_KEY = 'admin-data-v1';
const QUESTIONS_TABLE = 'admin_questions';
const CATEGORIES_TABLE = 'admin_categories';

/** Build the initial dataset: category catalog, no questions. */
function seed(): AdminData {
  const categories: AdminCategory[] = CATEGORIES.map(toAdminCategory);
  return { categories, questions: [] };
}

/** Synchronous load from localStorage cache (instant hydration). */
export function loadAdminData(): AdminData {
  if (typeof window === 'undefined') return seed();
  const cached = readCache<AdminData>(STORAGE_KEY);
  if (cached && cached.categories && cached.questions) return cached;
  const initial = seed();
  writeCache(STORAGE_KEY, initial);
  return initial;
}

/** Async load from the per-row tables (durable source of truth). Merges both
 * tables into a single AdminData snapshot. Returns 'notfound' only when both
 * tables are empty (fresh project). */
export async function loadAdminDataRemote(): Promise<LoadResult<AdminData>> {
  const [catRes, qRes] = await Promise.all([
    listRows<AdminCategory>(CATEGORIES_TABLE),
    listRows<AdminQuestion>(QUESTIONS_TABLE),
  ]);
  if (catRes.status === 'error' || qRes.status === 'error') {
    return { status: 'error', data: null, error: catRes.error ?? qRes.error };
  }
  const categories = catRes.data ?? [];
  const questions = qRes.data ?? [];
  if (categories.length === 0 && questions.length === 0) {
    return { status: 'notfound', data: null };
  }
  const finalCategories = categories.length > 0 ? categories : CATEGORIES.map(toAdminCategory);
  const data: AdminData = { categories: finalCategories, questions };
  writeCache(STORAGE_KEY, data);
  return { status: 'found', data };
}

/** Persist to localStorage cache (synchronous). */
export function saveAdminData(data: AdminData): void {
  writeCache(STORAGE_KEY, data);
}

// ─── Per-row remote operations ──────────────────────────────────────

export async function saveQuestionRemote(question: AdminQuestion): Promise<StorageResult> {
  return upsertRow(QUESTIONS_TABLE, question);
}

export async function saveQuestionsRemote(questions: AdminQuestion[]): Promise<StorageResult> {
  return upsertRows(QUESTIONS_TABLE, questions);
}

export async function deleteQuestionRemote(id: string): Promise<StorageResult> {
  return deleteRow(QUESTIONS_TABLE, id);
}

export async function saveCategoryRemote(category: AdminCategory): Promise<StorageResult> {
  return upsertRow(CATEGORIES_TABLE, category);
}

export async function deleteCategoryRemote(id: string): Promise<StorageResult> {
  return deleteRow(CATEGORIES_TABLE, id);
}

/** Wipe both stores and reseed the category catalog (questions stay empty). */
export function resetAdminData(): AdminData {
  const fresh = seed();
  saveAdminData(fresh);
  return fresh;
}

/** Generate a unique-ish id for a newly created category or question. */
export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
