import { supabase, hasSupabaseConfig } from './supabase-client';

/**
 * Durable persistence backed by Supabase Database.
 *
 * Questions and categories use NORMALIZED tables (questions, categories) with
 * real columns — one row per item. Supabase is the only source of truth.
 * localStorage is NOT used for the question bank.
 *
 * The app_state table (JSONB blob) is still used for other keys like
 * admin-settings and interactive-categories.
 */

const APP_STATE_TABLE = 'app_state';

export interface StorageResult {
  ok: boolean;
  error?: string;
  status?: number;
}

export interface LoadResult<T> {
  status: 'found' | 'notfound' | 'error';
  data: T | null;
  error?: string;
}

// ─── app_state (JSONB blob) — still used for settings, interactive cats ───

export async function putState<T>(key: string, value: T): Promise<StorageResult> {
  try {
    if (!hasSupabaseConfig) {
      return { ok: false, error: 'Supabase is not configured' };
    }
    const { error } = await supabase
      .from(APP_STATE_TABLE)
      .upsert({ id: key, data: value }, { onConflict: 'id' });
    if (error) {
      return { ok: false, error: `Database upsert failed for key "${key}": ${error.message}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Exception upserting key "${key}": ${msg}` };
  }
}

export async function getState<T>(key: string): Promise<LoadResult<T>> {
  try {
    if (!hasSupabaseConfig) {
      return { status: 'error', data: null, error: 'Supabase is not configured' };
    }
    const { data, error } = await supabase
      .from(APP_STATE_TABLE)
      .select('data')
      .eq('id', key)
      .maybeSingle();
    if (error) {
      return { status: 'error', data: null, error: `Database select failed for key "${key}": ${error.message}` };
    }
    if (!data) return { status: 'notfound', data: null };
    return { status: 'found', data: (data as { data: T }).data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 'error', data: null, error: `Exception selecting key "${key}": ${msg}` };
  }
}

// ─── localStorage helpers (cache only, not source of truth) ────────────

export function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

// ─── Normalized questions table ────────────────────────────────────────

export interface QuestionRow {
  id: string;
  category: string;
  points: number;
  difficulty: string;
  question: string;
  question_type: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  answer: string;
  image: string | null;
  audio: string | null;
  video: string | null;
  tmdb_id: number | null;
  tmdb_media: string | null;
}

export interface CategoryRow {
  id: string;
  name: string;
  description: string;
  glyph: string;
  gradient: string;
  image: string | null;
}

/**
 * Fetch ALL questions with pagination to bypass Supabase's default 1000-row
 * limit. Pages through results 1000 at a time until exhausted.
 */
export async function fetchAllQuestions(): Promise<LoadResult<QuestionRow[]>> {
  try {
    if (!hasSupabaseConfig) {
      return { status: 'error', data: null, error: 'Supabase is not configured' };
    }
    const PAGE_SIZE = 1000;
    let allRows: QuestionRow[] = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from('questions')
        .select('id, category, points, difficulty, question, question_type, option_a, option_b, option_c, option_d, answer, image, audio, video, tmdb_id, tmdb_media')
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        return { status: 'error', data: null, error: `Select failed on questions: ${error.message}` };
      }
      const rows = (data ?? []) as unknown as QuestionRow[];
      allRows = allRows.concat(rows);
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    if (allRows.length === 0) return { status: 'notfound', data: [] };
    return { status: 'found', data: allRows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 'error', data: null, error: `Exception fetching questions: ${msg}` };
  }
}

export async function fetchAllCategories(): Promise<LoadResult<CategoryRow[]>> {
  try {
    if (!hasSupabaseConfig) {
      return { status: 'error', data: null, error: 'Supabase is not configured' };
    }
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, description, glyph, gradient, image');
    if (error) {
      return { status: 'error', data: null, error: `Select failed on categories: ${error.message}` };
    }
    const rows = (data ?? []) as unknown as CategoryRow[];
    if (rows.length === 0) return { status: 'notfound', data: [] };
    return { status: 'found', data: rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 'error', data: null, error: `Exception fetching categories: ${msg}` };
  }
}

export async function upsertQuestionRow(q: QuestionRow): Promise<StorageResult> {
  try {
    if (!hasSupabaseConfig) return { ok: false, error: 'Supabase is not configured' };
    const { error } = await supabase
      .from('questions')
      .upsert({ ...q, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) return { ok: false, error: `Upsert question failed: ${error.message}` };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Exception upserting question: ${msg}` };
  }
}

export async function upsertQuestionRows(rows: QuestionRow[]): Promise<StorageResult> {
  if (rows.length === 0) return { ok: true };
  try {
    if (!hasSupabaseConfig) return { ok: false, error: 'Supabase is not configured' };
    const now = new Date().toISOString();
    const payload = rows.map((r) => ({ ...r, updated_at: now }));
    const { error } = await supabase
      .from('questions')
      .upsert(payload, { onConflict: 'id' });
    if (error) return { ok: false, error: `Bulk upsert questions failed: ${error.message}` };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Exception bulk upserting questions: ${msg}` };
  }
}

export async function deleteQuestionRow(id: string): Promise<StorageResult> {
  try {
    if (!hasSupabaseConfig) return { ok: false, error: 'Supabase is not configured' };
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) return { ok: false, error: `Delete question failed: ${error.message}` };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Exception deleting question: ${msg}` };
  }
}

export async function upsertCategoryRow(c: CategoryRow): Promise<StorageResult> {
  try {
    if (!hasSupabaseConfig) return { ok: false, error: 'Supabase is not configured' };
    const { error } = await supabase
      .from('categories')
      .upsert({ ...c, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) return { ok: false, error: `Upsert category failed: ${error.message}` };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Exception upserting category: ${msg}` };
  }
}

export async function deleteCategoryRow(id: string): Promise<StorageResult> {
  try {
    if (!hasSupabaseConfig) return { ok: false, error: 'Supabase is not configured' };
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) return { ok: false, error: `Delete category failed: ${error.message}` };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Exception deleting category: ${msg}` };
  }
}

/** Delete all questions belonging to a category (used when a category is removed). */
export async function deleteQuestionsByCategory(categoryId: string): Promise<StorageResult> {
  try {
    if (!hasSupabaseConfig) return { ok: false, error: 'Supabase is not configured' };
    const { error } = await supabase.from('questions').delete().eq('category', categoryId);
    if (error) return { ok: false, error: `Delete questions by category failed: ${error.message}` };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Exception deleting questions by category: ${msg}` };
  }
}
