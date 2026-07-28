import type { InteractiveCategory, QRSession } from './types';

/**
 * Local-only persistence for the Interactive Categories Engine.
 *
 * Mirrors the pattern used by the admin content store: seed defaults on first
 * run, persist every mutation to localStorage. The store is structured so it
 * can later be swapped for database sync without touching the context or UI.
 *
 * QR sessions are kept in-memory + localStorage (ephemeral by nature) and are
 * never persisted long-term — they expire and are cleaned up automatically.
 */

const CATEGORIES_KEY = 'interactive-categories-v1';
const SESSIONS_KEY = 'interactive-qr-sessions-v1';

/** Default interactive categories seeded on first run. */
function seedCategories(): InteractiveCategory[] {
  return [
    {
      id: 'ic-wordless',
      name: 'ولا كلمة',
      description: 'اللاعب يمسح QR ليرى الكلمة السرية على هاتفه فقط',
      interactionType: 'qr',
      pluginId: 'wordless',
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

export function loadInteractiveCategories(): InteractiveCategory[] {
  if (typeof window === 'undefined') return seedCategories();
  try {
    const raw = window.localStorage.getItem(CATEGORIES_KEY);
    if (!raw) {
      const initial = seedCategories();
      window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as InteractiveCategory[];
    if (!Array.isArray(parsed)) throw new Error('bad shape');
    return parsed;
  } catch {
    const fresh = seedCategories();
    try {
      window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(fresh));
    } catch {
      /* ignore */
    }
    return fresh;
  }
}

export function saveInteractiveCategories(cats: InteractiveCategory[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
  } catch {
    /* ignore */
  }
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
