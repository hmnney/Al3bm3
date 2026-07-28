import type { QuestionDifficulty } from '@/lib/types';

// Re-export the pipeline's ImportedRow so all modules share one definition.
export type { ImportedRow } from '../pipeline/types';

/**
 * AI analysis service — type definitions.
 *
 * The detailed breakdown, quality analysis, and duplicate-kind fields are
 * OPTIONAL additions layered on top of the original fields. The existing UI
 * keeps working because it only reads the original fields; future UI can opt
 * into the richer data without any backend change.
 */

/** Row-level structural flags (the original set, kept stable for the UI). */
export type AnalysisFlag =
  | 'empty-row'
  | 'missing-answer'
  | 'invalid-category'
  | 'duplicate'
  | 'similar';

/** Quality flags produced by the quality analyzer. */
export type QualityFlag =
  | 'too-easy'
  | 'too-vague'
  | 'multiple-answers'
  | 'answer-mismatch'
  | 'incomplete-question'
  | 'incomplete-answer';

/** The kind of duplicate detected. */
export type DuplicateKind = 'exact' | 'near-identical' | 'same-meaning';

/** The status the analyzer assigns to each row. */
export type AnalysisStatus =
  | 'accepted'
  | 'rejected'
  | 'duplicate'
  | 'needs-review'
  | 'needs-manual-review';

/**
 * Detailed difficulty breakdown — the Advanced Difficulty Engine output.
 * Every score is 0–100 (higher = more of that trait). These are the reasoning
 * signals the engine evaluates; difficulty is derived from them, NEVER from
 * question length.
 */
export interface DifficultyBreakdown {
  generalKnowledgeScore: number;
  specificKnowledgeScore: number;
  reasoningScore: number;
  memoryScore: number;
  fanKnowledgeScore: number;
  ambiguityScore: number;
  triviaSimilarityScore: number;
  reasoningSteps: number;
}

/** Difficulty decision with a confidence score. */
export interface DifficultySuggestion {
  difficulty: QuestionDifficulty;
  confidence: number;
  reason: string;
  breakdown?: DifficultyBreakdown;
  explanation?: string;
}

/** Quality analysis result for one question. */
export interface QualityAnalysis {
  flags: QualityFlag[];
  score: number;
  notes: string;
}

/** Full analysis result for one imported row. */
export interface RowAnalysis {
  rowIndex: number;
  status: AnalysisStatus;
  flags: AnalysisFlag[];
  difficultySuggestion: DifficultySuggestion;
  duplicateOf?: number;
  similarity?: number;
  duplicateKind?: DuplicateKind;
  difficultyBreakdown?: DifficultyBreakdown;
  explanation?: string;
  quality?: QualityAnalysis;
}

/**
 * The analyzer interface. Any future AI backend implements this.
 */
export interface QuestionAnalyzer {
  readonly name: string;
  analyze(
    rows: import('../pipeline/types').ImportedRow[],
    validCategoryIds: string[]
  ): Promise<RowAnalysis[]>;
}

/** Final tallies for the import summary screen. */
export interface ImportSummary {
  total: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  missingAnswers: number;
  emptyRows: number;
  invalidCategories: number;
  needsManualReview?: number;
  qualityIssues?: number;
}

/** A row combined with its analysis — the unit the review screen renders. */
export interface ReviewedRow {
  row: import('../pipeline/types').ImportedRow;
  analysis: RowAnalysis;
}
