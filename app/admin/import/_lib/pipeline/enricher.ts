import type { RowEnrichment, ImportedRow } from './types';
import { normalizeDifficulty } from './types';
import { getAIProvider, type AIProviderConfig, type ClassifyResult } from '../../../ai/_lib';
import { loadSettings } from '../../../_lib/settings-store';

/**
 * AI Enricher module — infers category, difficulty, and points for rows where
 * the Category column is empty, using the configured AI provider
 * (Gemini / Groq / OpenRouter). Falls back to the mock classifier when AI is
 * disabled.
 *
 * Difficulty → Points mapping:
 *   easy   → 250
 *   medium → 500
 *   hard   → 750
 *
 * Isolated: takes raw rows + existing category names, returns enrichments.
 */

export interface EnrichOptions {
  existingCategoryNames: string[];
  /** Called on each enriched row for progress. */
  onProgress?: (done: number, total: number) => void;
}

/** Enrich rows that have an empty Category column. Rows with a category are
 *  passed through with usedAI=false. */
export async function enrichRows(
  rows: ImportedRow[],
  options: EnrichOptions
): Promise<RowEnrichment[]> {
  const config = loadSettings().ai;
  const provider = getAIProvider(config);

  const results: RowEnrichment[] = [];
  const total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawCategory = row.category.trim();

    if (rawCategory) {
      // Category present — no AI needed. Still normalize difficulty/points.
      const difficulty = normalizeDifficulty(row.difficulty);
      const points = parsePoints(row.points) ?? difficultyToPoints(difficulty);
      results.push({
        rowIndex: row.rowIndex,
        aiCategory: rawCategory,
        aiDifficulty: difficulty,
        aiPoints: points,
        confidence: 100,
        usedAI: false,
      });
    } else {
      // Category empty — call AI.
      let ai: ClassifyResult;
      try {
        ai = await provider.classifyRow(
          {
            question: row.question,
            answer: row.answer,
            existingCategories: options.existingCategoryNames,
          },
          config
        );
      } catch {
        ai = mockFallback(row, options.existingCategoryNames);
      }
      results.push({
        rowIndex: row.rowIndex,
        aiCategory: ai.category || 'عام',
        aiDifficulty: ai.difficulty,
        aiPoints: ai.points,
        confidence: ai.confidence,
        usedAI: true,
      });
    }

    options.onProgress?.(i + 1, total);
    // Yield periodically so the UI can update.
    if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  return results;
}

/** Local mock fallback when the AI call fails. */
function mockFallback(
  row: ImportedRow,
  existing: string[]
): ClassifyResult {
  const q = row.question.trim();
  let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  if (q.length < 25) difficulty = 'easy';
  else if (q.length > 80) difficulty = 'hard';
  const points = difficultyToPoints(difficulty);
  return {
    category: existing[0] ?? 'عام',
    difficulty,
    points,
    confidence: 50,
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
