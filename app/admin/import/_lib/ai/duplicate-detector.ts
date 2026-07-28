import type { DuplicateKind } from './types';
import {
  bigramSimilarity,
  normalize,
  tokenOverlap,
} from './text-utils';

/**
 * Duplicate detector — detects three tiers of duplication:
 *
 *  1. Exact duplicate: identical after normalization.
 *  2. Near-identical: very high character-bigram + token overlap (reordered
 *     words, minor typos, added/removed punctuation).
 *  3. Same meaning, different wording: moderate token overlap with shared
 *     content words but different surface form.
 *
 * Pure functions: the analyzer feeds in candidate pairs and gets back a
 * verdict + score. No I/O, no state — easy to unit-test and to replace with a
 * real semantic-similarity model later.
 */

export interface DuplicateVerdict {
  kind: DuplicateKind | null;
  /** 0–100 similarity. */
  score: number;
  /** Index of the earlier row this one duplicates, when kind is set. */
  duplicateOf: number;
}

/** Thresholds. Tunable without touching callers. */
const EXACT = 100;
const NEAR_IDENTICAL_TOKEN = 78; // token overlap %
const NEAR_IDENTICAL_BIGRAM = 80; // bigram overlap %
const SAME_MEANING_TOKEN = 55; // token overlap % for same-meaning tier

/**
 * Compare one question against an earlier question and classify the
 * relationship. Returns `kind: null` when the two are not duplicates.
 */
export function classifyPair(
  current: string,
  earlier: string,
  earlierIndex: number
): DuplicateVerdict {
  const nc = normalize(current);
  const ne = normalize(earlier);
  if (!nc || !ne) return { kind: null, score: 0, duplicateOf: earlierIndex };

  // Tier 1: exact after normalization.
  if (nc === ne) {
    return { kind: 'exact', score: EXACT, duplicateOf: earlierIndex };
  }

  const token = tokenOverlap(current, earlier) * 100;
  const bigram = bigramSimilarity(current, earlier) * 100;

  // Tier 2: near-identical — both token and bigram overlap are high.
  if (token >= NEAR_IDENTICAL_TOKEN || bigram >= NEAR_IDENTICAL_BIGRAM) {
    const score = Math.round(Math.max(token, bigram));
    return { kind: 'near-identical', score, duplicateOf: earlierIndex };
  }

  // Tier 3: same meaning, different wording — moderate shared content words.
  if (token >= SAME_MEANING_TOKEN) {
    return {
      kind: 'same-meaning',
      score: Math.round(token),
      duplicateOf: earlierIndex,
    };
  }

  return { kind: null, score: Math.round(token), duplicateOf: earlierIndex };
}

/**
 * Find the best (highest-similarity) duplicate verdict for `current` against a
 * list of earlier (question, index) pairs. Returns the first exact match if
 * any, otherwise the highest-scoring near-identical / same-meaning verdict.
 */
export function findDuplicate(
  current: string,
  earlier: Array<{ question: string; rowIndex: number }>
): DuplicateVerdict | null {
  let best: DuplicateVerdict | null = null;
  for (let i = 0; i < earlier.length; i++) {
    const prev = earlier[i];
    if (!prev.question.trim()) continue;
    const verdict = classifyPair(current, prev.question, prev.rowIndex);
    if (!verdict.kind) continue;
    // Exact match wins immediately.
    if (verdict.kind === 'exact') return verdict;
    if (!best || verdict.score > best.score) best = verdict;
  }
  return best;
}

/** Human-readable Arabic label for a duplicate kind. */
export function duplicateLabel(kind: DuplicateKind): string {
  if (kind === 'exact') return 'مكرر تماماً';
  if (kind === 'near-identical') return 'شبه مطابق';
  return 'نفس المعنى بصياغة مختلفة';
}
