import type { QuestionDifficulty } from '@/lib/types';
import type { AdminCategory, AdminQuestion } from '../../_lib/types';

/**
 * System Diagnostics — type definitions.
 *
 * The diagnostics service consumes the existing admin store (categories +
 * questions) and the settings store (hidden/disabled categories) and produces
 * a full health report: statistics, a 0–100 health score, issues, and
 * suggestions. Pure functions, fully local, prepared for future AI
 * integration via the `DiagnosticsEngine` interface.
 */

export interface DiagnosticsStats {
  totalCategories: number;
  totalQuestions: number;
  questionsPerCategory: Array<{ categoryId: string; name: string; count: number }>;
  questionsPerDifficulty: Record<QuestionDifficulty, number>;
  imagesCount: number;
  audioCount: number;
  videoCount: number;
  missingImages: number;
  missingAudio: number;
  missingVideo: number;
  questionsWithoutAnswers: number;
  duplicateQuestions: number;
  hiddenCategories: number;
  disabledCategories: number;
}

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface DiagnosticIssue {
  severity: IssueSeverity;
  message: string;
}

export type SuggestionPriority = 'high' | 'medium' | 'low';

export interface DiagnosticSuggestion {
  priority: SuggestionPriority;
  message: string;
}

export interface HealthScore {
  score: number;
  breakdown: {
    duplicates: number;
    answers: number;
    media: number;
    categoryBalance: number;
    difficultyBalance: number;
    quality: number;
  };
}

export interface DiagnosticsResult {
  stats: DiagnosticsStats;
  health: HealthScore;
  issues: DiagnosticIssue[];
  suggestions: DiagnosticSuggestion[];
}

export interface DiagnosticsEngine {
  readonly name: string;
  analyze(
    categories: AdminCategory[],
    questions: AdminQuestion[],
    hiddenIds: string[],
    disabledIds: string[]
  ): Promise<DiagnosticsResult>;
}
