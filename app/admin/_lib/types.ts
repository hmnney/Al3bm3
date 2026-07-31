import type {
  Category,
  CategoryId,
  Question,
  QuestionDifficulty,
} from '@/lib/types';

/**
 * Admin-layer types. These extend the core game types with an admin category
 * (which carries an editable image filename and a generated id for categories
 * created from the panel) and an admin question (which may point at any
 * admin category, including a future-created one).
 *
 * Everything here is intentionally local-only — the admin panel runs on an
 * in-memory + localStorage store, not a database, so future features (Excel
 * import, AI generation, Supabase sync) can plug in by replacing the store
 * implementation without touching the UI.
 */

export interface AdminCategory {
  /** Stable id. For seeded categories this is the original CategoryId. */
  id: string;
  name: string;
  description: string;
  glyph: string;
  gradient: string;
  /** Optional local image filename under /public/category-images/. */
  image?: string;
}

export interface AdminQuestion {
  id: string;
  categoryId: string;
  difficulty: QuestionDifficulty;
  points: 250 | 500 | 750;
  question: string;
  answer: string;
  /** Optional local media filenames under /public/{images,audio,video}/. */
  image?: string;
  audio?: string;
  video?: string;
  /** TMDB numeric id, for duplicate detection on poster imports. */
  tmdb_id?: number;
  /** Media type for TMDB: 'movie' | 'tv'. */
  tmdb_media?: 'movie' | 'tv';
}

/** The full admin dataset, persisted to localStorage as one blob. */
export interface AdminData {
  categories: AdminCategory[];
  questions: AdminQuestion[];
}

/** Convert a core game Question to the admin shape. */
export function toAdminQuestion(q: Question): AdminQuestion {
  return {
    id: q.id,
    categoryId: q.categoryId,
    difficulty: q.difficulty,
    points: q.points,
    question: q.question,
    answer: q.answer,
    image: q.image,
    audio: q.audio,
    video: q.video,
  };
}

/** Convert a core game Category to the admin shape. */
export function toAdminCategory(c: Category): AdminCategory {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    glyph: c.glyph,
    gradient: c.gradient,
  };
}

/** Media type a question carries, for the filter/badge. */
export type MediaType = 'image' | 'audio' | 'video' | 'none';

export function mediaTypeOf(q: AdminQuestion): MediaType {
  if (q.image) return 'image';
  if (q.audio) return 'audio';
  if (q.video) return 'video';
  return 'none';
}

export type CategoryIdOrCustom = CategoryId | string;
