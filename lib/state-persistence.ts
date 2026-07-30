import { supabase, hasSupabaseConfig } from './supabase-client';

/**
 * Durable persistence backed by the Supabase Database `app_state` table.
 *
 * Each key is stored as a row keyed by `id` (text) with the JSON-serializable
 * value in the `data` column (jsonb). localStorage is used as a fast
 * synchronous cache so the UI renders instantly; the database is the source
 * of truth so data survives project restarts and is shared across browsers.
 */

const TABLE = 'app_state';

export interface StorageResult {
  ok: boolean;
  /** Human-readable error message (never generic). */
  error?: string;
  /** HTTP status if available. */
  status?: number;
}

/** Write a JSON-serializable value to the `app_state` table (upsert by key). */
export async function putState<T>(key: string, value: T): Promise<StorageResult> {
  try {
    if (!hasSupabaseConfig) {
      return { ok: false, error: 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env' };
    }

    const { error } = await supabase
      .from(TABLE)
      .upsert({ id: key, data: value }, { onConflict: 'id' });

    if (error) {
      return {
        ok: false,
        status: (error as { statusCode?: number }).statusCode,
        error: `Database upsert failed for key "${key}" on table "${TABLE}": ${error.message}`,
      };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Exception upserting key "${key}" to table "${TABLE}": ${msg}`,
    };
  }
}

/** Read a JSON-serializable value from the `app_state` table by key. Returns null if missing/error. */
export async function getState<T>(key: string): Promise<T | null> {
  try {
    if (!hasSupabaseConfig) {
      return null;
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select('data')
      .eq('id', key)
      .maybeSingle();

    if (error) {
      console.error('[state-persistence] getState error:', {
        key,
        message: error.message,
      });
      return null;
    }
    if (!data) {
      return null;
    }

    return (data as { data: T }).data;
  } catch (e) {
    console.error('[state-persistence] getState exception:', { key, error: e });
    return null;
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
