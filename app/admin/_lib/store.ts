import { CATEGORIES } from '@/lib/constants';
import { QUESTION_BANK } from '@/data';
import type { AdminCategory, AdminData, AdminQuestion } from './types';
import { toAdminCategory, toAdminQuestion } from './types';

/**
 * Local-only admin store. Seeds itself from the existing in-memory question
 * bank + category catalog on first run, then persists every mutation to
 * localStorage so admin edits survive reloads. No database, no network.
 *
 * Future features (Excel import, AI generation, Supabase sync) replace this
 * module's internals — the React context above it exposes a stable CRUD API
 * so the UI never needs to change.
 */

const STORAGE_KEY = 'admin-data-v1';

/** Build the initial dataset from the game's existing question bank. */
function seed(): AdminData {
  const categories: AdminCategory[] = CATEGORIES.map(toAdminCategory);
  const questions: AdminQuestion[] = Object.values(QUESTION_BANK)
    .flat()
    .map(toAdminQuestion);
  return { categories, questions };
}

/** Read the persisted dataset, or seed + persist on first run. */
export function loadAdminData(): AdminData {
  if (typeof window === 'undefined') return seed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = seed();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as AdminData;
    if (!parsed.categories || !parsed.questions) throw new Error('bad shape');
    return parsed;
  } catch {
    // Corrupt or missing — reseed so the panel always has data.
    const fresh = seed();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      /* ignore quota errors */
    }
    return fresh;
  }
}

/** Persist the dataset. Silently ignores quota/access errors. */
export function saveAdminData(data: AdminData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Wipe the persisted dataset and reseed from the question bank. */
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
