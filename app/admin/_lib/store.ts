import { CATEGORIES } from '@/lib/constants';
import type { AdminCategory, AdminData } from './types';
import { toAdminCategory } from './types';
import {
  getState,
  putState,
  readCache,
  writeCache,
  type StorageResult,
  type LoadResult,
} from '@/lib/state-persistence';

/**
 * Admin data store. The persisted admin question bank (localStorage cache +
 * Supabase Storage) is the ONLY source of questions for the game — there is
 * no static demo fallback. On first run the store seeds only the category
 * catalog (names/glyphs), with an empty question list; the admin then adds or
 * imports questions.
 */

const STORAGE_KEY = 'admin-data-v1';
const REMOTE_KEY = 'admin-data';

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

/** Async load from the app_state table (durable source of truth). */
export async function loadAdminDataRemote(): Promise<LoadResult<AdminData>> {
  const result = await getState<AdminData>(REMOTE_KEY);
  if (result.status === 'found' && result.data && result.data.categories && result.data.questions) {
    writeCache(STORAGE_KEY, result.data);
    return result;
  }
  // notfound or error — return local cache/seed WITHOUT uploading, but
  // propagate the status so the caller can distinguish the two.
  console.log('[admin-store] loadAdminDataRemote — no remote data, returning cache. status:', result.status, result.error ?? '');
  return { status: result.status, data: loadAdminData(), error: result.error };
}

/** Persist to localStorage cache (synchronous). */
export function saveAdminData(data: AdminData): void {
  writeCache(STORAGE_KEY, data);
}

/** Persist to Supabase Storage (durable). Returns detailed result. */
export async function saveAdminDataRemote(data: AdminData): Promise<StorageResult> {
  return putState(REMOTE_KEY, data);
}

/** Wipe both stores and reseed the category catalog (questions stay empty). */
export function resetAdminData(): AdminData {
  const fresh = seed();
  saveAdminData(fresh);
  void saveAdminDataRemote(fresh);
  return fresh;
}

/** Generate a unique-ish id for a newly created category or question. */
export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
