import type { QuestionDifficulty } from '@/lib/types';
import type {
  CategoryBalanceAnalysis,
  DifficultyDistribution,
  RecommendedAdd,
} from './types';
import type { ImportedRow, RowAnalysis } from '../ai/types';
import { difficultyToPoints } from './rewriter';

/**
 * Category balance analysis — counts the difficulty distribution across the
 * whole imported file and recommends how many questions of each difficulty to
 * add so the file is balanced.
 *
 * Consumes analyzer results only (the suggested difficulty per row); never
 * recomputes difficulty.
 *
 * Target balance heuristic: a healthy trivia board skews slightly toward easy
 * with a solid medium core and a smaller hard set. We target roughly
 *   easy 40% · medium 35% · hard 25%
 * and recommend additions to close the gap toward that target.
 */

/** Ideal proportions per difficulty. */
const TARGET: Record<QuestionDifficulty, number> = {
  easy: 0.4,
  medium: 0.35,
  hard: 0.25,
};

const ORDER: QuestionDifficulty[] = ['easy', 'medium', 'hard'];

function labelOf(d: QuestionDifficulty): string {
  return d === 'easy' ? 'سهل' : d === 'medium' ? 'متوسط' : 'صعب';
}

/** Count the analyzer-suggested difficulty across non-empty, non-duplicate rows. */
function distributionOf(analyses: RowAnalysis[]): DifficultyDistribution {
  let easy = 0;
  let medium = 0;
  let hard = 0;
  analyses.forEach((a) => {
    if (a.flags.includes('empty-row') || a.flags.includes('duplicate')) return;
    const d = a.difficultySuggestion.difficulty;
    if (d === 'easy') easy++;
    else if (d === 'medium') medium++;
    else hard++;
  });
  return { easy, medium, hard, total: easy + medium + hard };
}

/**
 * Recommend how many questions of each difficulty to add to approach the
 * target balance. Returns 0-count recommendations when a tier is already at
 * or above its target share.
 */
function recommendAdds(
  dist: DifficultyDistribution
): RecommendedAdd[] {
  const total = dist.total;
  const out: RecommendedAdd[] = [];
  if (total === 0) return out;

  ORDER.forEach((d) => {
    const current = dist[d];
    const currentShare = current / total;
    const targetShare = TARGET[d];
    const shortfall = targetShare - currentShare;
    // Only recommend additions for under-represented tiers.
    if (shortfall <= 0.03) return;
    // Recommend enough new questions to close the gap, rounded to a sensible
    // batch size (multiples of ~2, minimum 2 when there's any shortfall).
    const raw = shortfall * total;
    const count = Math.max(2, Math.round(raw / 0.5) * 2);
    out.push({
      difficulty: d,
      points: difficultyToPoints(d),
      count,
      reason:
        `حصة ${labelOf(d)} الحالية ${(currentShare * 100).toFixed(0)}% وهي أقل من المستهدف ${(targetShare * 100).toFixed(0)}%؛ أضف حوالي ${count} سؤال ${labelOf(d)} لتقريب التوزيع من التوازن.`,
    });
  });

  return out;
}

/** Overall coaching notes string. */
function notesFor(
  dist: DifficultyDistribution,
  adds: RecommendedAdd[]
): string {
  if (dist.total === 0) {
    return 'لا توجد أسئلة قابلة للتحليل بعد؛ أضف أسئلة لتوليد توصيات التوازن.';
  }
  const parts: string[] = [];
  parts.push(
    `التوزيع الحالي: ${dist.easy} سهل · ${dist.medium} متوسط · ${dist.hard} صعب من أصل ${dist.total}.`
  );
  if (adds.length === 0) {
    parts.push('التوزيع متوازن نسبياً ولا يحتاج إضافات توازن كبيرة.');
  } else {
    parts.push(
      'يُنصح بإضافات لتقريب التوزيع من 40% سهل / 35% متوسط / 25% صعب.'
    );
  }
  return parts.join(' ');
}

/** Run the category balance analysis over the analyzer results. */
export function analyzeBalance(
  _rows: ImportedRow[],
  analyses: RowAnalysis[]
): CategoryBalanceAnalysis {
  void _rows;
  const distribution = distributionOf(analyses);
  const recommendedAdds = recommendAdds(distribution);
  return {
    distribution,
    recommendedAdds,
    notes: notesFor(distribution, recommendedAdds),
  };
}
