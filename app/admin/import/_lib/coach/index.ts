import type { AICoach } from './types';
import { MockAICoach } from './mock-coach';

/**
 * Coach factory — the single swap point for the AI Coach backend.
 *
 * The Coach is a separate layer from the Analyzer. It consumes analyzer
 * results and never replaces them. To plug in a real AI model later (OpenAI,
 * a local LLM, a Supabase edge function, etc.), create a class that
 * implements `AICoach` and return it here instead of the mock. No UI code
 * needs to change.
 *
 * The active coach is read once per coaching run and held in module scope so
 * the same instance is reused.
 */

let active: AICoach | null = null;

export function getCoach(): AICoach {
  if (!active) {
    // Future: replace with a real AI-backed coach, e.g.
    //   active = new OpenAiCoach({ apiKey: ... });
    active = new MockAICoach();
  }
  return active;
}

/** Reset the cached coach (useful for tests / future config switches). */
export function resetCoach(): void {
  active = null;
}

// Public surface of the coach package.
export type {
  AICoach,
  CoachResult,
  QuestionCoaching,
  RewriteSuggestion,
  RewriteKind,
  PointsTarget,
  DifficultyDistribution,
  CategoryBalanceAnalysis,
  RecommendedAdd,
  TopicCluster,
  TopicDiversityAnalysis,
  TopicRecommendation,
  ImportReport,
  QuestionQualitySummary,
} from './types';
export { MockAICoach } from './mock-coach';
export { coachQuestion, difficultyToPoints, difficultyLabel } from './rewriter';
export { analyzeBalance } from './balance';
export { analyzeDiversity } from './diversity';
export { buildReport } from './report';
