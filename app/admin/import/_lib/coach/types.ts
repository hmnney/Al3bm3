import type { PointValue, QuestionDifficulty } from '@/lib/types';
import type { ImportedRow, RowAnalysis } from '../ai/types';

/**
 * AI Coach — type definitions.
 *
 * The Coach is a *separate* layer that consumes the existing AI Analyzer's
 * results (`RowAnalysis[]`) and produces coaching advice: per-question
 * improvement suggestions, rewrites, harder variants, plus a whole-file
 * import report. It NEVER re-runs analyzer logic and NEVER replaces it.
 *
 * Like the analyzer, the Coach talks to the rest of the app only through the
 * `AICoach` interface, so the mock coach can be swapped for a real AI model
 * later by changing the factory in `index.ts` — no UI changes required.
 */

/** Point-value target for a rewrite (mirrors the game's point tiers). */
export type PointsTarget = PointValue; // 250 | 500 | 750

/** What kind of rewrite a suggestion represents. */
export type RewriteKind =
  | 'better-balance' // same difficulty, better wording/balance
  | 'harder' // raises the point tier
  | 'wording-only'; // hard (750) — only wording is refined, tier unchanged

/** A single suggested rewrite of a question. */
export interface RewriteSuggestion {
  kind: RewriteKind;
  /** Point tier the rewrite targets (250 / 500 / 750). */
  targetPoints: PointsTarget;
  /** The rewritten question text (Arabic). */
  rewrittenQuestion: string;
  /** Optional rewritten answer, when the rewrite changes the expected answer. */
  rewrittenAnswer?: string;
  /** Why this rewrite achieves its target (Arabic). */
  explanation: string;
}

/** Coaching output for one analyzed question. */
export interface QuestionCoaching {
  rowIndex: number;
  /** The analyzer-assigned difficulty, consumed (never recomputed). */
  currentDifficulty: QuestionDifficulty;
  /** Current point tier derived from the difficulty (250/500/750). */
  currentPoints: PointsTarget;
  /**
   * Difficulty improvement suggestion, e.g. "هذا السؤال سهل لأن...".
   * Driven by the analyzer's breakdown + quality flags.
   */
  improvementSuggestion: string;
  /** Suggested rewrites (better balance / harder / wording-only per the rules). */
  rewrites: RewriteSuggestion[];
}

/** Counts per difficulty tier across the imported file. */
export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
  total: number;
}

/** A "add N questions of difficulty X" recommendation. */
export interface RecommendedAdd {
  difficulty: QuestionDifficulty;
  points: PointsTarget;
  count: number;
  reason: string;
}

/** Category balance analysis for the whole imported file. */
export interface CategoryBalanceAnalysis {
  distribution: DifficultyDistribution;
  /** Recommended additions to balance the distribution, if any. */
  recommendedAdds: RecommendedAdd[];
  /** Free-form coaching notes (Arabic). */
  notes: string;
}

/** A cluster of questions sharing one dominant topic/entity. */
export interface TopicCluster {
  /** The dominant token/entity the cluster revolves around. */
  topic: string;
  count: number;
  rowIndices: number[];
  /** Up to three sample question texts from the cluster. */
  sampleQuestions: string[];
}

/** A "add topic X" recommendation to diversify the file. */
export interface TopicRecommendation {
  addTopic: string;
  reason: string;
}

/** Topic diversity analysis for the whole imported file. */
export interface TopicDiversityAnalysis {
  /** Repeated topics detected, sorted by count descending. */
  clusters: TopicCluster[];
  /** Recommended topics to add for diversity. */
  recommendations: TopicRecommendation[];
  notes: string;
}

/** Question-quality section of the report. */
export interface QuestionQualitySummary {
  total: number;
  /** Rows with at least one quality flag. */
  withQualityIssues: number;
  /** Counts per quality flag kind. */
  flagCounts: Record<string, number>;
  /** Average quality score (0–100) across non-empty rows. */
  averageScore: number;
}

/** The complete import report assembled by the Coach. */
export interface ImportReport {
  /** ISO timestamp the report was generated. */
  generatedAt: string;
  questionQuality: QuestionQualitySummary;
  difficultyDistribution: DifficultyDistribution;
  categoryBalance: CategoryBalanceAnalysis;
  topicDiversity: TopicDiversityAnalysis;
  /** Row indices flagged as weak (low quality / low confidence / severe). */
  weakQuestions: number[];
  /** Row indices flagged as excellent (high confidence + good quality). */
  excellentQuestions: number[];
  /** Row indices requiring manual review (low confidence / needs-review). */
  manualReview: number[];
}

/** Full Coach output: per-question coaching + the whole-file report. */
export interface CoachResult {
  perQuestion: QuestionCoaching[];
  report: ImportReport;
}

/**
 * The Coach interface. Any future AI backend implements this. The mock
 * implementation (`mock-coach.ts`) delegates to pure, modular services
 * (rewriter, balance, diversity, report) and consumes analyzer results only.
 */
export interface AICoach {
  readonly name: string;

  /**
   * Coach a batch of imported rows GIVEN the analyzer's results.
   * Implementations MUST consume `analyses` as-is — never recompute difficulty,
   * duplicates, or quality. They produce per-question coaching + an import
   * report from those results.
   *
   * `rows` and `analyses` must be the same length and aligned by index.
   */
  coach(
    rows: ImportedRow[],
    analyses: RowAnalysis[]
  ): Promise<CoachResult>;
}

// Re-exported consumed types so Coach callers don't need to reach into the
// analyzer package directly.
export type { ImportedRow, RowAnalysis } from '../ai/types';
