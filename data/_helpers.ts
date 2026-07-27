import type { CategoryId, PointValue, Question, QuestionDifficulty } from '@/lib/types';

/**
 * Placeholder generator for the question bank. Produces `count` fake questions
 * per (points, difficulty) tier for a category, each with a stable id like
 * `"<categoryId>-<points>-<n>"`. No real content — just Arabic placeholders
 * so the board can exercise the full draw/repeat-avoidance flow.
 *
 * Difficulty is derived from points: 250 -> easy, 500 -> medium, 750 -> hard.
 */
function buildCategoryQuestions(
  categoryId: CategoryId,
  count = 6
): Question[] {
  const tiers: Array<{ points: PointValue; difficulty: QuestionDifficulty }> = [
    { points: 250, difficulty: 'easy' },
    { points: 500, difficulty: 'medium' },
    { points: 750, difficulty: 'hard' },
  ];

  const out: Question[] = [];
  for (const tier of tiers) {
    for (let i = 1; i <= count; i++) {
      out.push({
        id: `${categoryId}-${tier.points}-${i}`,
        categoryId,
        difficulty: tier.difficulty,
        points: tier.points,
        question: `سؤال تجريبي ${tier.difficulty === 'easy' ? 'سهل' : tier.difficulty === 'medium' ? 'متوسط' : 'صعب'} ${tier.points} نقطة #${i}`,
        answer: `إجابة تجريبية #${i}`,
      });
    }
  }
  return out;
}

export { buildCategoryQuestions };
