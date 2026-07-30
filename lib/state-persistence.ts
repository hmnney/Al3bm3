import { supabase, hasSupabaseConfig } from './supabase-client';

/**
 * Durable persistence backed by the Supabase Database `app_state` table.
 *
 * Each key is stored as a row keyed by `id` (text) with the JSON-serializable
 * value in the `data` column (jsonb). localStorage is used as a fast
 * synchronous cache so the UI renders instantly; the database is the source
 * of truth so data survives project restarts and is shared across browsers.
 *
 * Every cloud operation is logged loudly. Errors are never swallowed silently —
 * callers receive a result object that distinguishes "found", "not found",
 * and "error" so they can decide explicitly whether to fall back to cache.
 */

const TABLE = 'app_state';

export interface StorageResult {
  ok: boolean;
  /** Human-readable error message (never generic). */
  error?: string;
  /** HTTP status if available. */
  status?: number;
}

export interface LoadResult<T> {
  /** "found" — data exists. "notfound" — row is absent. "error" — request failed. */
  status: 'found' | 'notfound' | 'error';
  data: T | null;
  error?: string;
}

/** Write a JSON-serializable value to the `app_state` table (upsert by key). */
export async function putState<T>(key: string, value: T): Promise<StorageResult> {
  console.log('[state-persistence] SAVE START', { table: TABLE, key });
  try {
    if (!hasSupabaseConfig) {
      console.error('[state-persistence] SAVE FAILED — Supabase not configured');
      return { ok: false, error: 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env' };
    }

    console.log('[state-persistence] SAVE upsert', { table: TABLE, key, valueKeys: typeof value === 'object' && value ? Object.keys(value as Record<string, unknown>) : typeof value });

    const { data: _data, error } = await supabase
      .from(TABLE)
      .upsert({ id: key, data: value }, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('[state-persistence] SAVE FAILED', { key, error });
      return {
        ok: false,
        status: (error as { statusCode?: number }).statusCode,
        error: `Database upsert failed for key "${key}" on table "${TABLE}": ${error.message}`,
      };
    }

    console.log('[state-persistence] SAVE SUCCESS', { key, rowsReturned: _data?.length ?? 0 });
    return { ok: true };
  } catch (e) {
    console.error('[state-persistence] SAVE EXCEPTION', { key, error: e });
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Exception upserting key "${key}" to table "${TABLE}": ${msg}`,
    };
  }
}

/** Read a JSON-serializable value from the `app_state` table by key. */
export async function getState<T>(key: string): Promise<LoadResult<T>> {
  console.log('[state-persistence] LOAD START', { table: TABLE, key });
  try {
    if (!hasSupabaseConfig) {
      console.error('[state-persistence] LOAD FAILED — Supabase not configured');
      return { status: 'error', data: null, error: 'Supabase is not configured' };
    }

    console.log('[state-persistence] LOAD select', { table: TABLE, key });

    const { data, error } = await supabase
      .from(TABLE)
      .select('data')
      .eq('id', key)
      .maybeSingle();

    if (error) {
      console.error('[state-persistence] LOAD FAILED', { key, error });
      return {
        status: 'error',
        data: null,
        error: `Database select failed for key "${key}" on table "${TABLE}": ${error.message}`,
      };
    }

    if (!data) {
      console.log('[state-persistence] LOAD NOT FOUND', { key, message: 'No row with this id exists in app_state' });
      return { status: 'notfound', data: null };
    }

    console.log('[state-persistence] LOAD SUCCESS', { key, dataKeys: typeof (data as { data: unknown }).data === 'object' && (data as { data: Record<string, unknown> }).data ? Object.keys((data as { data: Record<string, unknown> }).data) : typeof (data as { data: unknown }).data });
    return { status: 'found', data: (data as { data: T }).data };
  } catch (e) {
    console.error('[state-persistence] LOAD EXCEPTION', { key, error: e });
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: 'error',
      data: null,
      error: `Exception selecting key "${key}" from table "${TABLE}": ${msg}`,
    };
  }
}

/** localStorage helpers — fast synchronous cache layer. */
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
