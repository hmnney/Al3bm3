import type { InteractiveCategory, QRSession } from './types';
import {
  ensureStateBucket,
  getState,
  putState,
  readCache,
  writeCache,
} from '@/lib/state-persistence';

/**
 * Persistence for the Interactive Categories Engine. localStorage is the
 * fast cache; Supabase Storage is the durable source of truth.
 *
 * QR sessions are kept in-memory + localStorage (ephemeral by nature) and
 * are never persisted to Supabase — they expire and are cleaned up
 * automatically.
 */

const CATEGORIES_KEY = 'interactive-categories-v1';
const REMOTE_KEY = 'interactive-categories';
const SESSIONS_KEY = 'interactive-qr-sessions-v1';

/** Default interactive categories seeded on first run. */
function seedCategories(): InteractiveCategory[] {
  return [
    {
      id: 'ic-wordless',
      name: 'ولا كلمة',
      description: 'اللاعب يمسح QR ليرى الكلمة السرية على هاتفه فقط',
      interactionType: 'qr',
      pluginId: 'word-only',
      config: {
        singleUse: true,
        expirationSeconds: 120,
        connectionTimeoutSeconds: 60,
        secretContent: 'اكتب الكلمة السرية هنا',
      },
      enabled: true,
    },
  ];
}

/** Synchronous load from localStorage cache (instant hydration). */
export function loadInteractiveCategories(): InteractiveCategory[] {
  if (typeof window === 'undefined') return seedCategories();
  const cached = readCache<InteractiveCategory[]>(CATEGORIES_KEY);
  if (cached && Array.isArray(cached)) return cached;
  const initial = seedCategories();
  writeCache(CATEGORIES_KEY, initial);
  return initial;
}

/** Async load from Supabase Storage (durable source of truth). */
export async function loadInteractiveCategoriesRemote(): Promise<InteractiveCategory[]> {
  await ensureStateBucket();
  const remote = await getState<InteractiveCategory[]>(REMOTE_KEY);
  if (remote && Array.isArray(remote)) {
    writeCache(CATEGORIES_KEY, remote);
    return remote;
  }
  const local = loadInteractiveCategories();
  await putState(REMOTE_KEY, local);
  return local;
}

/** Persist to localStorage cache (synchronous). */
export function saveInteractiveCategories(cats: InteractiveCategory[]): void {
  writeCache(CATEGORIES_KEY, cats);
}

/** Persist to Supabase Storage (durable). Fire-and-forget. */
export async function saveInteractiveCategoriesRemote(
  cats: InteractiveCategory[]
): Promise<void> {
  await putState(REMOTE_KEY, cats);
}

export function loadQRSessions(): Record<string, QRSession> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, QRSession>;
  } catch {
    return {};
  }
}

export function saveQRSessions(sessions: Record<string, QRSession>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    /* ignore */
  }
}

let idCounter = 0;
export function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
