import type {
  AICoach,
  CoachResult,
  QuestionCoaching,
} from './types';
import type { ImportedRow, RowAnalysis } from '../ai/types';
import { coachQuestion } from './rewriter';
import { buildReport } from './report';

/**
 * Mock AI Coach — orchestrates the coaching services.
 *
 * It is a STRICT consumer of the existing AI Analyzer: it takes the
 * analyzer's `RowAnalysis[]` results as input and never recomputes
 * difficulty, duplicates, or quality. It only layers coaching *on top* of
 * those results (improvement suggestions, rewrites, balance, diversity,
 * report).
 *
 * The coaching itself is intelligent mocked reasoning (Arabic), generated
 * locally — no external AI call. To replace the mock with a real AI model
 * later, write a new class implementing `AICoach` and point the factory in
 * `index.ts` at it; no UI code needs to change.
 */
export class MockAICoach implements AICoach {
  readonly name = 'مدرب ذكي متقدم';

  async coach(
    rows: ImportedRow[],
    analyses: RowAnalysis[]
  ): Promise<CoachResult> {
    if (rows.length !== analyses.length) {
      throw new Error(
        'AI Coach: rows and analyses must be the same length and aligned by index.'
      );
    }

    // Simulate async coaching work without blocking the UI thread.
    await new Promise((r) => setTimeout(r, 700));

    const perQuestion: QuestionCoaching[] = rows.map((row, i) =>
      coachQuestion(row, analyses[i])
    );

    const report = buildReport(rows, analyses);

    return { perQuestion, report };
  }
}
