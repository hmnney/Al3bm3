import type { PointValue, QuestionDifficulty } from '@/lib/types';

/**
 * AI Question Designer — type definitions.
 *
 * The Designer is a completely isolated service that generates mocked questions
 * locally (no external AI). It is prepared for a future real AI connection via
 * the `DesignerEngine` interface: swap the factory in `index.ts` and no UI
 * changes are needed.
 *
 * Accepted questions flow into the existing Question Bank through
 * `useAdmin().addQuestion(...)` — the Designer never touches the store directly.
 */

/** The generation styles the designer supports. */
export type QuestionStyle =
  | 'general' // معرفة عامة
  | 'guess-image' // خمّن الصورة
  | 'guess-player' // خمّن اللاعب
  | 'audio' // صوت
  | 'video' // فيديو
  | 'story' // القصة تقول
  | 'order-events'; // رتّب الأحداث

/** Arabic labels for each style. */
export const STYLE_LABELS: Record<QuestionStyle, string> = {
  general: 'معرفة عامة',
  'guess-image': 'خمّن الصورة',
  'guess-player': 'خمّن اللاعب',
  audio: 'صوت',
  video: 'فيديو',
  story: 'القصة تقول',
  'order-events': 'رتّب الأحداث',
};

/** Icons (lucide names) for each style — resolved in the UI. */
export const STYLE_ICONS: Record<QuestionStyle, string> = {
  general: 'Brain',
  'guess-image': 'Image',
  'guess-player': 'Trophy',
  audio: 'AudioLines',
  video: 'Video',
  story: 'BookOpen',
  'order-events': 'ListOrdered',
};

/** Admin's generation request. */
export interface DesignerRequest {
  /** Target category id (an existing AdminCategory id). */
  categoryId: string;
  /** The topic to generate about, e.g. "كرة القدم" or "أنمي ناروتو". */
  topic: string;
  /** Optional keywords to weave into the questions. */
  keywords: string;
  /** Target difficulty / point tier. */
  targetDifficulty: QuestionDifficulty;
  /** How many questions to generate (1–20). */
  count: number;
  /** The generation style. */
  style: QuestionStyle;
}

/** One generated question with full metadata. */
export interface GeneratedQuestion {
  /** Ephemeral id unique within a generation batch (not a bank id). */
  tempId: string;
  question: string;
  answer: string;
  difficulty: QuestionDifficulty;
  points: PointValue;
  categoryId: string;
  style: QuestionStyle;
  /** Why this difficulty was selected (Arabic). */
  reasoning: string;
  /** Optional media hints for image/audio/video styles. */
  mediaHint?: string;
  /** Whether the admin has acted on this question. */
  status: 'pending' | 'accepted' | 'rejected';
}

/** The designer engine interface — the swap point for future real AI. */
export interface DesignerEngine {
  readonly name: string;
  /** Generate a batch of mocked questions from the request. */
  generate(request: DesignerRequest): Promise<GeneratedQuestion[]>;
  /** Regenerate a single question with fresh variation. */
  regenerate(question: GeneratedQuestion, request: DesignerRequest): Promise<GeneratedQuestion>;
  /** Improve a question's wording/clarity without changing difficulty. */
  improve(question: GeneratedQuestion, request: DesignerRequest): Promise<GeneratedQuestion>;
}

/** Map a difficulty to its game point tier. */
export function difficultyToPoints(d: QuestionDifficulty): PointValue {
  return d === 'easy' ? 250 : d === 'medium' ? 500 : 750;
}

/** Arabic label for a difficulty. */
export function difficultyLabel(d: QuestionDifficulty): string {
  return d === 'easy' ? 'سهل' : d === 'medium' ? 'متوسط' : 'صعب';
}
