import type { QuestionDifficulty, PointValue } from '@/lib/types';

/**
 * Question Database Builder — shared types.
 *
 * This feature is completely isolated from the rest of the admin panel. It
 * reuses the AI Provider Manager (getAIProvider) and the AdminContext
 * (addQuestion) but owns its own state, UI, and pipeline.
 *
 * Future plugins (Images, Audio, Posters, Video) reuse this builder by
 * extending `BuilderQuestion` with optional media fields — the generation
 * engine and review table already pass them through.
 */

export type GenerationMode = 'mixed' | 'easy' | 'medium' | 'hard';

export const COUNT_OPTIONS = [10, 25, 50, 100, 250] as const;
export type QuestionCount = (typeof COUNT_OPTIONS)[number];

export const MODE_LABELS: Record<GenerationMode, string> = {
  mixed: 'مختلط',
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
};

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
};

export const POINTS_FOR_DIFFICULTY: Record<QuestionDifficulty, PointValue> = {
  easy: 250,
  medium: 500,
  hard: 750,
};

/** A single generated question awaiting review. */
export interface BuilderQuestion {
  /** Client-side id for React keys and table operations. */
  tempId: string;
  categoryId: string;
  question: string;
  answer: string;
  difficulty: QuestionDifficulty;
  points: PointValue;
}

/** Progress emitted during generation. */
export interface GenerationProgress {
  done: number;
  total: number;
  pct: number;
  phase: 'preparing' | 'generating' | 'retrying' | 'done' | 'error';
  message: string;
}

/** Configuration for a generation run. */
export interface GenerationConfig {
  categoryId: string;
  categoryName: string;
  count: QuestionCount;
  mode: GenerationMode;
}

/** Resolve how many questions of each difficulty to generate. */
export function difficultySplit(mode: GenerationMode, count: number): {
  easy: number;
  medium: number;
  hard: number;
} {
  if (mode === 'easy') return { easy: count, medium: 0, hard: 0 };
  if (mode === 'medium') return { easy: 0, medium: count, hard: 0 };
  if (mode === 'hard') return { easy: 0, medium: 0, hard: count };
  // mixed — even split, remainder goes to medium
  const easy = Math.floor(count / 3);
  const hard = Math.floor(count / 3);
  const medium = count - easy - hard;
  return { easy, medium, hard };
}

/** Simple unique id for builder questions. */
export function builderId(): string {
  return `bq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
