/**
 * Category matcher — fuzzy matching of imported category names against the
 * existing admin categories.
 *
 * Match order (first hit wins):
 *   1. Exact category id
 *   2. Exact slug
 *   3. Exact Arabic name (after trim)
 *   4. Exact English name (if available)
 *   5. Normalized Arabic name (ignoring spaces, case, and Arabic letter variants)
 *
 * Arabic normalization handles:
 *   - leading/trailing spaces and multiple internal spaces
 *   - case differences (English)
 *   - أ / إ / آ  → ا
 *   - ى → ي
 *   - ة → ه (when `normalizeTaMarbuta` is true, which it is by default)
 *
 * If multiple existing categories normalize to the same string, the match is
 * "ambiguous" and the admin must choose which one to use.
 */

export interface MatchableCategory {
  id: string;
  name: string;
  slug?: string;
  englishName?: string;
}

export type MatchKind =
  | 'id'
  | 'slug'
  | 'exact-name'
  | 'exact-english'
  | 'normalized-name';

export interface CategoryMatchResult {
  /** The matched category id, or null if no match. */
  categoryId: string | null;
  /** Whether the match is ambiguous (multiple candidates). */
  ambiguous: boolean;
  /** All candidate ids when ambiguous. */
  candidates: string[];
  /** How the match was found, for display. */
  kind: MatchKind | null;
}

/**
 * Normalize an Arabic string for fuzzy matching.
 * - Trims and collapses whitespace
 * - Lowercases (for English)
 * - Normalizes Arabic letter variants
 * - Optionally normalizes ة → ه
 */
export function normalizeArabic(
  input: string,
  options: { normalizeTaMarbuta?: boolean } = {}
): string {
  const normalizeTa = options.normalizeTaMarbuta ?? true;
  return (
    input
      .trim()
      // Collapse multiple spaces / tabs / non-breaking spaces into one.
      .replace(/[\s\u00A0\u200C\u200D]+/g, ' ')
      .toLowerCase()
      // Arabic letter variants.
      .replace(/[\u0623\u0625\u0622]/g, '\u0627') // أ إ آ → ا
      .replace(/\u0649/g, '\u064A') // ى → ي
      .replace(/\u0629/g, normalizeTa ? '\u0647' : '\u0629') // ة → ه (optional)
  );
}

/**
 * Find the best matching existing category for an imported category string.
 *
 * @param raw The category value from the imported row (could be id, slug, or name).
 * @param existing The list of existing categories to match against.
 * @returns A CategoryMatchResult describing the match.
 */
export function matchCategory(
  raw: string,
  existing: MatchableCategory[]
): CategoryMatchResult {
  const value = raw.trim();
  if (!value) {
    return { categoryId: null, ambiguous: false, candidates: [], kind: null };
  }

  // 1. Exact id match.
  const byId = existing.find((c) => c.id === value);
  if (byId) {
    return {
      categoryId: byId.id,
      ambiguous: false,
      candidates: [],
      kind: 'id',
    };
  }

  // 2. Exact slug match.
  const bySlug = existing.find((c) => c.slug && c.slug === value);
  if (bySlug) {
    return {
      categoryId: bySlug.id,
      ambiguous: false,
      candidates: [],
      kind: 'slug',
    };
  }

  // 3. Exact Arabic name match (case-insensitive, trimmed).
  const exactName = existing.filter(
    (c) => c.name.trim().toLowerCase() === value.toLowerCase()
  );
  if (exactName.length === 1) {
    return {
      categoryId: exactName[0].id,
      ambiguous: false,
      candidates: [],
      kind: 'exact-name',
    };
  }
  if (exactName.length > 1) {
    return {
      categoryId: null,
      ambiguous: true,
      candidates: exactName.map((c) => c.id),
      kind: 'exact-name',
    };
  }

  // 4. Exact English name match (if available).
  const exactEnglish = existing.filter(
    (c) => c.englishName && c.englishName.trim().toLowerCase() === value.toLowerCase()
  );
  if (exactEnglish.length === 1) {
    return {
      categoryId: exactEnglish[0].id,
      ambiguous: false,
      candidates: [],
      kind: 'exact-english',
    };
  }
  if (exactEnglish.length > 1) {
    return {
      categoryId: null,
      ambiguous: true,
      candidates: exactEnglish.map((c) => c.id),
      kind: 'exact-english',
    };
  }

  // 5. Normalized Arabic name match.
  const normalizedValue = normalizeArabic(value);
  const normalizedMatches = existing.filter(
    (c) => normalizeArabic(c.name) === normalizedValue
  );
  if (normalizedMatches.length === 1) {
    return {
      categoryId: normalizedMatches[0].id,
      ambiguous: false,
      candidates: [],
      kind: 'normalized-name',
    };
  }
  if (normalizedMatches.length > 1) {
    return {
      categoryId: null,
      ambiguous: true,
      candidates: normalizedMatches.map((c) => c.id),
      kind: 'normalized-name',
    };
  }

  // No match found.
  return { categoryId: null, ambiguous: false, candidates: [], kind: null };
}

/**
 * Batch-match a list of unique category names from the imported file.
 * Returns a map of raw name → match result, so the UI can display the
 * resolution before importing.
 */
export function matchCategories(
  rawNames: string[],
  existing: MatchableCategory[]
): Map<string, CategoryMatchResult> {
  const map = new Map<string, CategoryMatchResult>();
  for (const name of rawNames) {
    if (!map.has(name)) {
      map.set(name, matchCategory(name, existing));
    }
  }
  return map;
}
