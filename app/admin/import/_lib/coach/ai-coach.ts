import type {
  AICoach,
  CoachResult,
  QuestionCoaching,
} from './types';
import type { ImportedRow, RowAnalysis } from '../ai/types';
import { coachQuestion } from './rewriter';
import { buildReport } from './report';
import { MockAICoach } from './mock-coach';
import { getAIProvider, type AIProviderConfig } from '../../../ai/_lib';
import { loadSettings } from '../../../_lib/settings-store';

/**
 * AI-backed Coach adapter.
 *
 * Uses the active AI provider to enhance per-question improvement suggestions.
 * Falls back to the local mock coach when AI is disabled or the call fails.
 * The structured import report is always built locally because it requires
 * exact shapes the AI provider doesn't produce.
 */

function readAIConfig(): AIProviderConfig {
  return loadSettings().ai;
}

export class AICoachAdapter implements AICoach {
  readonly name = 'مدرب ذكي بالذكاء الاصطناعي';

  async coach(
    rows: ImportedRow[],
    analyses: RowAnalysis[]
  ): Promise<CoachResult> {
    if (rows.length !== analyses.length) {
      throw new Error(
        'AI Coach: rows and analyses must be the same length and aligned by index.'
      );
    }

    const config = readAIConfig();
    if (!config.enabled || !config.apiKey || config.provider === 'mock') {
      return new MockAICoach().coach(rows, analyses);
    }

    // Start with local coaching (always works, gives us the structured base).
    const localPerQuestion = rows.map((row, i) => coachQuestion(row, analyses[i]));
    const report = buildReport(rows, analyses);

    try {
      const provider = getAIProvider(config);
      const aiQuestions = rows.map((r, idx) => ({
        question: r.question,
        answer: r.answer,
        difficulty: analyses[idx].difficultySuggestion.difficulty,
        category: r.category,
      }));
      const aiResult = await provider.coachQuestions({ questions: aiQuestions }, config);

      // Merge AI suggestions into the local per-question coaching.
      const perQuestion: QuestionCoaching[] = localPerQuestion.map((pq, i) => {
        const aiSuggestion = aiResult.suggestions[i];
        if (aiSuggestion) {
          return {
            ...pq,
            improvementSuggestion:
              aiSuggestion.message || pq.improvementSuggestion,
          };
        }
        return pq;
      });

      return { perQuestion, report };
    } catch {
      return { perQuestion: localPerQuestion, report };
    }
  }
}
