import { supabase } from './supabase-client';

/**
 * Durable persistence backed by Supabase Storage.
 *
 * The admin panel stores three JSON blobs (admin data, settings, interactive
 * categories). localStorage is used as a fast cache so the UI renders
 * instantly; Supabase Storage is the source of truth so data survives
 * project restarts (which wipe localStorage in the preview environment).
 *
 * Each blob is stored as a single JSON file in the `app-state` bucket.
 */

const BUCKET = 'app-state';

/** Ensure the bucket exists. Safe to call repeatedly. */
export async function ensureStateBucket(): Promise<void> {
  try {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
    });
    if (error && !/already|409|exists/i.test(error.message)) {
      // Bucket may already exist or creation isn't permitted — ignore.
    }
  } catch {
    // ignore — bucket may already exist
  }
}

/** Write a JSON blob to Supabase Storage. Returns true on success. */
export async function putState<T>(key: string, value: T): Promise<boolean> {
  try {
    console.log('[state-persistence] putState START — key:', key);
    const body = JSON.stringify(value);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${key}.json`, body, {
        cacheControl: '0',
        upsert: true,
        contentType: 'application/json',
      });
    console.log('[state-persistence] putState END — key:', key, 'error:', error?.message ?? 'none');
    return !error;
  } catch (e) {
    console.error('[state-persistence] putState FAILED — key:', key, e);
    return false;
  }
}

/** Read a JSON blob from Supabase Storage. Returns null if missing/error. */
export async function getState<T>(key: string): Promise<T | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(`${key}.json`);
    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text) as T;
  } catch {
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
