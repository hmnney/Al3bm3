import type { QuestionDifficulty } from '@/lib/types';

/**
 * AI analysis service — type definitions.
 *
 * This module defines the contract between the Import Wizard UI and the AI
 * analysis layer. The UI only ever talks to `QuestionAnalyzer` (the
 * interface), never to a concrete implementation — so the mock analyzer can
 * be replaced with a real AI model (OpenAI, local LLM, etc.) by swapping the
 * factory in `analyzer.ts` without touching any UI code.
 *
 * The detailed breakdown, quality analysis, and duplicate-kind fields are
 * OPTIONAL additions layered on top of the original fields. The existing UI
 * keeps working because it only reads the original fields; future UI can opt
 * into the richer data without any backend change.
 */

/** A single raw row extracted from the uploaded file, before any analysis. */
export interface ImportedRow {
  /** Stable index within the uploaded file (0-based). */
  rowIndex: number;
  question: string;
  answer: string;
  /** Raw category string as written in the file (may be invalid). */
  category: string;
  /** Raw difficulty string from the file, if present (may be empty/invalid). */
  difficulty: string;
}

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
  /** How much broad, commonly-taught knowledge the question needs. */
  generalKnowledgeScore: number;
  /** How much niche / specialist knowledge the question needs. */
  specificKnowledgeScore: number;
  /** How many inference / reasoning steps the answer demands. */
  reasoningScore: number;
  /** How hard the answer is to recall from memory (exact dates, numbers). */
  memoryScore: number;
  /** How much deep fandom-specific knowledge is required. */
  fanKnowledgeScore: number;
  /** How ambiguous the question is (0 = precise, 100 = very vague). */
  ambiguityScore: number;
  /** How similar the question is to well-known common trivia (0 = novel, 100 = cliché). */
  triviaSimilarityScore: number;
  /** Estimated number of reasoning steps to reach the answer. */
  reasoningSteps: number;
}

/** Difficulty decision with a confidence score. */
export interface DifficultySuggestion {
  difficulty: QuestionDifficulty;
  /** 0–100 confidence in the suggested difficulty. */
  confidence: number;
  /** Short human-readable rationale (Arabic), shown on the review screen. */
  reason: string;
  /** Detailed per-signal breakdown (optional — future UI can render this). */
  breakdown?: DifficultyBreakdown;
  /** Full explanation of why this difficulty was chosen (Arabic). */
  explanation?: string;
}

/** Quality analysis result for one question. */
export interface QualityAnalysis {
  flags: QualityFlag[];
  /** Overall quality 0–100 (higher = better). */
  score: number;
  /** Human-readable note (Arabic). */
  notes: string;
}

/** Full analysis result for one imported row. */
export interface RowAnalysis {
  /** Matches the originating ImportedRow.rowIndex. */
  rowIndex: number;
  status: AnalysisStatus;
  flags: AnalysisFlag[];
  difficultySuggestion: DifficultySuggestion;
  /** Row index of a suspected duplicate/similar row within the same import. */
  duplicateOf?: number;
  /** Similarity score 0–100 when a near-duplicate was detected. */
  similarity?: number;
  /** Kind of duplicate detected, when applicable. */
  duplicateKind?: DuplicateKind;
  /** Detailed difficulty breakdown (optional — future UI can render this). */
  difficultyBreakdown?: DifficultyBreakdown;
  /** Full difficulty explanation (optional). */
  explanation?: string;
  /** Quality analysis (optional). */
  quality?: QualityAnalysis;
}

/**
 * The analyzer interface. Any future AI backend implements this. The mock
 * implementation lives in `mock-analyzer.ts` and delegates to modular
 * services (difficulty engine, duplicate detector, quality analyzer); the
 * active implementation is selected in `analyzer.ts`.
 */
export interface QuestionAnalyzer {
  /** Human-readable name, shown in the UI while analyzing. */
  readonly name: string;

  /**
   * Analyze a batch of imported rows. Implementations MUST:
   *  - suggest a difficulty for every row based on *reasoning signals*
   *    (knowledge required, memory, reasoning steps, fan knowledge,
   *    ambiguity, trivia similarity) — NEVER on question length,
   *  - detect exact, near-identical, and same-meaning duplicates,
   *  - run quality analysis (too easy, too vague, multiple answers,
   *    answer mismatch, incomplete question/answer),
   *  - flag rows with missing answers, empty rows, invalid categories,
   *  - mark low-confidence questions as needs-manual-review.
   *
   * `validCategoryIds` is the set of category ids the analyzer should treat as
   * valid (the existing game categories plus any admin-created ones).
   *
   * Returns one `RowAnalysis` per input row, in the same order.
   */
  analyze(
    rows: ImportedRow[],
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
  /** Questions flagged for manual review due to low confidence. */
  needsManualReview?: number;
  /** Questions flagged by the quality analyzer (any quality flag). */
  qualityIssues?: number;
}

/** A row combined with its analysis — the unit the review screen renders. */
export interface ReviewedRow {
  row: ImportedRow;
  analysis: RowAnalysis;
}
