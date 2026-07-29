import type { CategoryId, PointValue, Question } from '@/lib/types';

/**
 * Draw one random unused question for a (category, points) slot from the
 * provided pool. Returns null only if every question at that tier has
 * already been used this match — the board treats that as "level exhausted"
 * and disables the button.
 *
 * The game draws ONLY from the persisted admin question bank — the static
 * demo QUESTION_BANK is no longer used anywhere in the draw path.
 *
 * Pure function: callers pass the current used-id set so the draw stays in sync
 * with reducer state without the bank holding any mutable state of its own.
 */
export function drawQuestionForSlot(
  categoryId: CategoryId,
  points: PointValue,
  usedQuestionIds: string[],
  pool: Question[]
): Question | null {
  const available = pool.filter(
    (q) =>
      q.categoryId === categoryId &&
      q.points === points &&
      !usedQuestionIds.includes(q.id)
  );
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}
