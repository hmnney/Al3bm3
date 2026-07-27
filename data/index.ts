import type { CategoryId, PointValue, Question } from '@/lib/types';
import { conan } from './conan';
import { moviesSeriesPosters } from './movies-series-posters';
import { animePosters } from './anime-posters';
import { gamePosters } from './game-posters';
import { football } from './football';
import { saudiLeague } from './saudi-league';
import { wrestling } from './wrestling';
import { orderEvents } from './order-events';
import { story } from './story';
import { guessImage } from './guess-image';
import { general } from './general';
import { friends } from './friends';
import { celebrities } from './celebrities';
import { celebration } from './celebration';
import { voice } from './voice';

/**
 * The full question bank, keyed by category id. Each category file owns its
 * own questions so content can grow independently. To add a category, drop a
 * new file in /data and add it here.
 */
export const QUESTION_BANK: Record<CategoryId, Question[]> = {
  conan,
  'movie-posters': moviesSeriesPosters,
  'anime-posters': animePosters,
  'game-posters': gamePosters,
  football,
  'saudi-league': saudiLeague,
  wrestling,
  'order-events': orderEvents,
  'story-says': story,
  'guess-image': guessImage,
  general,
  friends,
  'who-celebrity': celebrities,
  'guess-celebration': celebration,
  'guess-voice': voice,
};

/**
 * Draw one random unused question for a (category, points) slot. Returns null
 * only if every question at that tier has already been used this match — the
 * board treats that as "level exhausted" and disables the button.
 *
 * Pure function: callers pass the current used-id set so the draw stays in sync
 * with reducer state without the bank holding any mutable state of its own.
 */
export function drawQuestionForSlot(
  categoryId: CategoryId,
  points: PointValue,
  usedQuestionIds: string[]
): Question | null {
  const pool = (QUESTION_BANK[categoryId] ?? []).filter(
    (q) => q.points === points && !usedQuestionIds.includes(q.id)
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
