import type { QuestionDifficulty } from '@/lib/types';
import type {
  AnalysisFlag,
  AnalysisStatus,
  ImportedRow,
  QuestionAnalyzer,
  RowAnalysis,
} from './types';
import { analyzeDifficulty, decideDifficulty } from './difficulty-engine';
import { findDuplicate, type DuplicateVerdict } from './duplicate-detector';
import {
  analyzeQuality,
  isSevereQuality,
} from './quality-analyzer';

/**
 * Mock question analyzer — now an orchestrator over three modular services:
 *
 *   1. Advanced Difficulty Engine  (difficulty-engine.ts)
 *   2. Duplicate Detector          (duplicate-detector.ts)
 *   3. Quality Analyzer            (quality-analyzer.ts)
 *
 * Each service is a pure module with a fixed output shape. To replace the mock
 * with a real AI model later, either:
 *   - swap the services' internals (e.g. feed real LLM scores into the same
 *     `DifficultyBreakdown` shape), or
 *   - write a new class implementing `QuestionAnalyzer` and point the factory
 *     in `analyzer.ts` at it.
 *
 * The UI only ever reads the original `RowAnalysis` fields (status, flags,
 * difficultySuggestion.*, similarity), so the new optional fields (breakdown,
 * explanation, quality, duplicateKind) layer on without breaking it.
 */

/** Confidence below which a question is flagged for manual review. */
const MANUAL_REVIEW_CONFIDENCE = 50;

const DIFFICULTY_ORDER: Record<QuestionDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export class MockQuestionAnalyzer implements QuestionAnalyzer {
  readonly name = 'محرك تحليل متقدم';

  async analyze(
    rows: ImportedRow[],
    validCategoryIds: string[]
  ): Promise<RowAnalysis[]> {
    // Simulate async analysis work without blocking the UI thread.
    await new Promise((r) => setTimeout(r, 600));

    const validSet = new Set(validCategoryIds);
    // Earlier questions accumulated for duplicate detection as we walk the batch.
    const earlier: Array<{ question: string; rowIndex: number }> = [];

    return rows.map((row): RowAnalysis => {
      const flags: AnalysisFlag[] = [];
      const isEmpty =
        !row.question.trim() && !row.answer.trim() && !row.category.trim();
      const hasQuestion = row.question.trim().length > 0;
      const hasAnswer = row.answer.trim().length > 0;
      const hasValidCategory =
        row.category.trim().length > 0 && validSet.has(row.category.trim());

      if (isEmpty) flags.push('empty-row');
      if (!isEmpty && !hasAnswer) flags.push('missing-answer');
      if (!isEmpty && row.category.trim().length > 0 && !hasValidCategory)
        flags.push('invalid-category');

      // --- Difficulty engine (reasoning-based, never length) ---
      const breakdown = analyzeDifficulty(row.question);
      const decision = decideDifficulty(row.question, breakdown);

      // --- Quality analysis ---
      const quality = hasQuestion
        ? analyzeQuality(row.question, row.answer)
        : { flags: [], score: 100, notes: 'صف فارغ' };

      // --- Duplicate detection (exact / near-identical / same-meaning) ---
      let dupVerdict: DuplicateVerdict | null = null;
      if (hasQuestion) {
        dupVerdict = findDuplicate(row.question, earlier);
        if (dupVerdict) {
          if (dupVerdict.kind === 'exact') {
            if (!flags.includes('duplicate')) flags.push('duplicate');
          } else {
            // near-identical or same-meaning → "similar" flag for the UI.
            if (!flags.includes('similar')) flags.push('similar');
          }
        }
        // Record this question for subsequent rows to compare against.
        earlier.push({ question: row.question, rowIndex: row.rowIndex });
      }

      // --- Determine final status ---
      // Priority: empty > duplicate > invalid > severe quality > low confidence.
      let status: AnalysisStatus = 'accepted';
      if (flags.includes('empty-row')) {
        status = 'rejected';
      } else if (flags.includes('duplicate')) {
        status = 'duplicate';
      } else if (
        flags.includes('invalid-category') ||
        flags.includes('missing-answer') ||
        flags.includes('similar')
      ) {
        status = 'needs-review';
      } else if (isSevereQuality(quality.flags)) {
        // No structural flag, but a severe quality issue → needs review.
        status = 'needs-review';
      } else if (decision.confidence < MANUAL_REVIEW_CONFIDENCE) {
        // Low-confidence difficulty decision → manual review.
        status = 'needs-manual-review';
      }

      return {
        rowIndex: row.rowIndex,
        status,
        flags,
        difficultySuggestion: decision,
        duplicateOf: dupVerdict?.duplicateOf,
        similarity: dupVerdict?.score,
        duplicateKind: dupVerdict?.kind ?? undefined,
        difficultyBreakdown: breakdown,
        explanation: decision.explanation,
        quality,
      };
    });
  }
}

/** Resolve the file's difficulty string into a typed value, if valid. */
export function parseDifficulty(raw: string): QuestionDifficulty | undefined {
  const d = raw.trim().toLowerCase();
  if (['easy', 'سهل', '1'].includes(d)) return 'easy';
  if (['medium', 'متوسط', '2'].includes(d)) return 'medium';
  if (['hard', 'صعب', '3'].includes(d)) return 'hard';
  return undefined;
}

/** Typed-utility export for callers that need the ordering. */
export { DIFFICULTY_ORDER };
