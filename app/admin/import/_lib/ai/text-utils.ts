/**
 * Shared text utilities for the AI analysis services.
 *
 * Arabic-aware normalization (diacritics, alef forms, ta-marbuta) plus
 * tokenization and similarity helpers. All duplicate-detection and
 * quality-analysis modules share these so text is compared consistently.
 *
 * NOTE: the project compiles to ES5, so Set/Map iteration uses `.forEach`
 * instead of `for...of`.
 */

/** Normalize Arabic + Latin text for fair comparison. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '') // strip Arabic diacritics
    .replace(/[أإآٱ]/g, 'ا') // unify alef forms
    .replace(/ى/g, 'ي') // unify alef-maqsura
    .replace(/ؤ/g, 'و') // unify waw-hamza
    .replace(/ئ/g, 'ي') // unify ya-hamza
    .replace(/ة/g, 'ه') // unify ta-marbuta
    .replace(/[^\p{L}\p{N} ]/gu, ' ') // keep letters/numbers/spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token set from normalized text (duplicates collapsed). */
export function tokenSet(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter(Boolean));
}

/** Token list from normalized text (duplicates kept, for frequency work). */
export function tokenList(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

/** Jaccard-style token overlap ratio, 0–1. */
export function tokenOverlap(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared++;
  });
  return shared / Math.max(ta.size, tb.size);
}

/** Containment ratio: how much of b's tokens are inside a, 0–1. */
export function containment(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (tb.size === 0) return 0;
  let shared = 0;
  tb.forEach((t) => {
    if (ta.has(t)) shared++;
  });
  return shared / tb.size;
}

/**
 * Character bigram Jaccard similarity, 0–1. Catches near-duplicates where
 * word boundaries differ but the character stream is almost the same.
 */
export function bigramSimilarity(a: string, b: string): number {
  const na = normalize(a).replace(/\s+/g, '');
  const nb = normalize(b).replace(/\s+/g, '');
  if (na.length < 2 || nb.length < 2) return 0;
  const ga = new Set<string>();
  for (let i = 0; i < na.length - 1; i++) ga.add(na.slice(i, i + 2));
  const gb = new Set<string>();
  for (let i = 0; i < nb.length - 1; i++) gb.add(nb.slice(i, i + 2));
  let shared = 0;
  ga.forEach((g) => {
    if (gb.has(g)) shared++;
  });
  return shared / Math.max(ga.size, gb.size);
}

/** Count how many of `needles` appear in `haystack` (case-insensitive). */
export function countMatches(haystack: string, needles: string[]): number {
  const h = haystack.toLowerCase();
  let n = 0;
  needles.forEach((needle) => {
    if (h.includes(needle.toLowerCase())) n++;
  });
  return n;
}

/** True if any of `needles` appears in `haystack` (case-insensitive). */
export function hasAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

/** Clamp a number into the 0–100 range. */
export function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
