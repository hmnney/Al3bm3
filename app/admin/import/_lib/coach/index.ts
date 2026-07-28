import type { AICoach } from './types';
import { MockAICoach } from './mock-coach';
import { AICoachAdapter } from './ai-coach';
import { loadSettings } from '../../../_lib/settings-store';

/**
 * Coach factory — the single swap point for the AI Coach backend.
 *
 * Returns the AI-backed coach when AI is enabled and configured, otherwise the
 * local mock coach. The UI only ever talks to the `AICoach` interface.
 */

let active: AICoach | null = null;

export function getCoach(): AICoach {
  if (!active) {
    const ai = loadSettings().ai;
    if (ai.enabled && ai.apiKey && ai.provider !== 'mock') {
      active = new AICoachAdapter();
    } else {
      active = new MockAICoach();
    }
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
