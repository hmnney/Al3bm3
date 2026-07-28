import type {
  DifficultyDistribution,
  ImportReport,
  QuestionQualitySummary,
} from './types';
import type { ImportedRow, RowAnalysis } from '../ai/types';
import { analyzeBalance } from './balance';
import { analyzeDiversity } from './diversity';
import { difficultyToPoints } from './rewriter';

/**
 * Import report builder — assembles the complete coaching report from the
 * analyzer results. Pure function: consumes `RowAnalysis` only, never
 * recomputes any analyzer signal.
 *
 * Sections produced:
 *   1. Question Quality          — flag counts + average quality score
 *   2. Difficulty Distribution   — easy/medium/hard counts
 *   3. Category Balance          — recommended additions per difficulty
 *   4. Topic Diversity           — repeated topics + recommended topics
 *   5. Weak Questions            — low quality / low confidence / severe
 *   6. Excellent Questions       — high confidence + good quality
 *   7. Manual Review             — low-confidence / needs-review rows
 */

/** Build the Question Quality section from analyzer quality results. */
function qualitySummary(analyses: RowAnalysis[]): QuestionQualitySummary {
  const eligible = analyses.filter(
    (a) => !a.flags.includes('empty-row')
  );
  const flagCounts: Record<string, number> = {};
  let withIssues = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  eligible.forEach((a) => {
    if (!a.quality) return;
    scoreSum += a.quality.score;
    scoreCount++;
    if (a.quality.flags.length > 0) {
      withIssues++;
      a.quality.flags.forEach((f) => {
        flagCounts[f] = (flagCounts[f] || 0) + 1;
      });
    }
  });

  return {
    total: analyses.length,
    withQualityIssues: withIssues,
    flagCounts,
    averageScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
  };
}

/** Build the Difficulty Distribution section. */
function difficultyDistribution(analyses: RowAnalysis[]): DifficultyDistribution {
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
 * Weak questions: rows with severe quality issues, very low confidence, or
 * flagged as too easy / mismatch / incomplete.
 */
function weakRows(analyses: RowAnalysis[]): number[] {
  const out: number[] = [];
  analyses.forEach((a) => {
    if (a.flags.includes('empty-row')) return;
    const severe =
      a.quality &&
      (a.quality.flags.includes('answer-mismatch') ||
        a.quality.flags.includes('incomplete-question') ||
        a.quality.flags.includes('incomplete-answer') ||
        a.quality.flags.includes('multiple-answers'));
    const tooEasy = a.quality && a.quality.flags.includes('too-easy');
    const lowConfidence = a.difficultySuggestion.confidence < 45;
    if (severe || tooEasy || lowConfidence) out.push(a.rowIndex);
  });
  return out;
}

/**
 * Excellent questions: high confidence + good quality + not a duplicate and
 * not too easy / too vague.
 */
function excellentRows(analyses: RowAnalysis[]): number[] {
  const out: number[] = [];
  analyses.forEach((a) => {
    if (a.flags.includes('empty-row') || a.flags.includes('duplicate')) return;
    if (a.flags.includes('similar')) return;
    const highConfidence = a.difficultySuggestion.confidence >= 70;
    const goodQuality =
      !a.quality ||
      (a.quality.flags.length === 0 && a.quality.score >= 80);
    if (highConfidence && goodQuality) out.push(a.rowIndex);
  });
  return out;
}

/** Manual review: low-confidence difficulty or analyzer-set review status. */
function manualReviewRows(analyses: RowAnalysis[]): number[] {
  const out: number[] = [];
  analyses.forEach((a) => {
    if (
      a.status === 'needs-manual-review' ||
      a.status === 'needs-review' ||
      a.difficultySuggestion.confidence < 50
    ) {
      out.push(a.rowIndex);
    }
  });
  return out;
}

/** Assemble the complete import report from analyzer results. */
export function buildReport(
  rows: ImportedRow[],
  analyses: RowAnalysis[]
): ImportReport {
  return {
    generatedAt: new Date().toISOString(),
    questionQuality: qualitySummary(analyses),
    difficultyDistribution: difficultyDistribution(analyses),
    categoryBalance: analyzeBalance(rows, analyses),
    topicDiversity: analyzeDiversity(rows, analyses),
    weakQuestions: weakRows(analyses),
    excellentQuestions: excellentRows(analyses),
    manualReview: manualReviewRows(analyses),
  };
}

// Re-export the points helper so callers of the report can render tiers.
export { difficultyToPoints };
