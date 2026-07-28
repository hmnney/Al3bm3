import type {
  CategoryResolution,
  ImportProgress,
  ImportReport,
  ImportedRow,
  RowEnrichment,
  RowOverride,
  ValidatedRow,
} from './types';
import { normalizeDifficulty } from './types';
import { matchCategory, type MatchableCategory } from './category-matcher';

/**
 * Importer module — executes the actual import, row by row, with progress.
 *
 * Category matching: before creating a category, the importer searches the
 * existing categories by id, slug, Arabic name, English name, and normalized
 * Arabic name. It only creates a new category when NO match exists AND the
 * admin explicitly approved creation.
 *
 * Enrichment: when AI enrichment was run, the importer uses the enriched
 * category/difficulty/points (with admin overrides applied) instead of the raw
 * row values. This is what makes questions attach to existing categories
 * instead of creating duplicates.
 */

export interface ImporterCallbacks {
  /** Create a new category, return its id. */
  createCategory: (name: string) => string;
  /** Create a new question. */
  createQuestion: (q: {
    categoryId: string;
    difficulty: 'easy' | 'medium' | 'hard';
    points: 250 | 500 | 750;
    question: string;
    answer: string;
    image?: string;
    audio?: string;
    video?: string;
  }) => void;
  /** Called on each imported row with current progress. */
  onProgress?: (p: ImportProgress) => void;
}

/** Run the import over validated rows. */
export async function runImport(
  validated: ValidatedRow[],
  resolutions: Record<string, CategoryResolution>,
  existingCategories: MatchableCategory[],
  callbacks: ImporterCallbacks,
  enrichments?: RowEnrichment[],
  overrides?: Record<number, RowOverride>
): Promise<ImportReport> {
  const importable = validated.filter((v) => v.status !== 'error');
  const total = importable.length;
  const startTime = Date.now();
  let imported = 0;
  let skipped = 0;
  let duplicates = 0;
  let warnings = 0;
  let errors = 0;
  let newCategories = 0;
  let matchedCategories = 0;

  const createdCategoryNames: string[] = [];
  const matchedCategoryNames: string[] = [];
  const resolvedCache = new Map<string, string>();

  // Build a lookup: rowIndex → enrichment.
  const enrichmentMap = new Map<number, RowEnrichment>();
  if (enrichments) {
    enrichments.forEach((e) => enrichmentMap.set(e.rowIndex, e));
  }

  for (let i = 0; i < importable.length; i++) {
    const { row, status, issues } = importable[i];

    if (issues.includes('سؤال مكرر')) duplicates++;
    if (status === 'warning') warnings++;
    if (status === 'error') errors++;

    // --- Determine effective category/difficulty/points ---
    const enrichment = enrichmentMap.get(row.rowIndex);
    const override = overrides?.[row.rowIndex];

    // Effective category: override > enrichment > raw row.
    const rawCategory = (override?.category ?? enrichment?.aiCategory ?? row.category).trim();

    // Effective difficulty: override > enrichment > raw row.
    const effectiveDifficulty = override?.difficulty
      ?? enrichment?.aiDifficulty
      ?? normalizeDifficulty(row.difficulty);

    // Effective points: override > enrichment > raw row > difficulty-derived.
    const effectivePoints = override?.points
      ?? enrichment?.aiPoints
      ?? parsePoints(row.points)
      ?? difficultyToPoints(effectiveDifficulty);

    // --- Resolve category ---
    let categoryId: string | null = null;

    if (resolvedCache.has(rawCategory)) {
      categoryId = resolvedCache.get(rawCategory)!;
    } else {
      const match = matchCategory(rawCategory, existingCategories);
      if (match.categoryId) {
        categoryId = match.categoryId;
        matchedCategories++;
        matchedCategoryNames.push(rawCategory);
        resolvedCache.set(rawCategory, categoryId);
      } else if (match.ambiguous) {
        const resolution = resolutions[rawCategory];
        if (resolution?.action === 'map' && resolution.mapToCategoryId) {
          categoryId = resolution.mapToCategoryId;
        } else {
          categoryId = match.candidates[0];
        }
        matchedCategories++;
        matchedCategoryNames.push(rawCategory);
        resolvedCache.set(rawCategory, categoryId);
      } else {
        // No match — only create if admin explicitly approved 'create'.
        const resolution = resolutions[rawCategory];
        if (resolution?.action === 'create') {
          const newId = callbacks.createCategory(rawCategory);
          newCategories++;
          createdCategoryNames.push(rawCategory);
          resolvedCache.set(rawCategory, newId);
          categoryId = newId;
        } else if (resolution?.action === 'skip') {
          skipped++;
          continue;
        } else if (resolution?.action === 'map' && resolution.mapToCategoryId) {
          categoryId = resolution.mapToCategoryId;
          matchedCategories++;
          matchedCategoryNames.push(rawCategory);
          resolvedCache.set(rawCategory, categoryId);
        } else {
          // No explicit approval — skip. Never auto-create.
          skipped++;
          continue;
        }
      }
    }

    if (!categoryId) {
      skipped++;
      continue;
    }

    callbacks.createQuestion({
      categoryId,
      difficulty: effectiveDifficulty,
      points: effectivePoints,
      question: row.question.trim(),
      answer: row.answer.trim(),
      image: row.image.trim() || undefined,
      audio: row.audio.trim() || undefined,
      video: row.video.trim() || undefined,
    });

    imported++;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = imported / Math.max(elapsed, 0.001);
    const remaining = total - imported;
    const estimatedSecondsLeft = remaining / Math.max(rate, 0.001);

    callbacks.onProgress?.({
      imported,
      remaining,
      total,
      pct: total > 0 ? (imported / total) * 100 : 100,
      estimatedSecondsLeft: Math.ceil(estimatedSecondsLeft),
    });

    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  errors += validated.filter((v) => v.status === 'error').length;

  return {
    imported,
    skipped,
    duplicates,
    warnings,
    errors,
    newCategories,
    matchedCategories,
    createdCategoryNames,
    matchedCategoryNames,
  };
}

function parsePoints(raw: string): 250 | 500 | 750 | undefined {
  const p = Number(raw.trim());
  if (Number.isNaN(p)) return undefined;
  if (p <= 250) return 250;
  if (p <= 500) return 500;
  return 750;
}

function difficultyToPoints(d: 'easy' | 'medium' | 'hard'): 250 | 500 | 750 {
  return d === 'easy' ? 250 : d === 'medium' ? 500 : 750;
}
