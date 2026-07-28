import type { QuestionDifficulty } from '@/lib/types';
import type {
  AnalysisFlag,
  AnalysisStatus,
  ImportedRow,
  QuestionAnalyzer,
  RowAnalysis,
} from './types';
import { MockQuestionAnalyzer } from './mock-analyzer';
import { analyzeDifficulty, decideDifficulty } from './difficulty-engine';
import { findDuplicate, type DuplicateVerdict } from './duplicate-detector';
import { analyzeQuality, isSevereQuality } from './quality-analyzer';
import { getAIProvider, type AIProviderConfig } from '../../../ai/_lib';
import { loadSettings } from '../../../_lib/settings-store';

/**
 * AI-backed question analyzer adapter.
 *
 * Uses the active AI provider to analyze the difficulty and quality of each
 * imported row. Falls back to the local mock analyzer when:
 *  - AI is disabled
 *  - No API key is set
 *  - The provider call fails
 *
 * The UI only ever talks to the `QuestionAnalyzer` interface, so no UI changes
 * are needed.
 */

const MANUAL_REVIEW_CONFIDENCE = 50;

function readAIConfig(): AIProviderConfig {
  return loadSettings().ai;
}

export class AIQuestionAnalyzer implements QuestionAnalyzer {
  readonly name = 'محلل أسئلة بالذكاء الاصطناعي';

  async analyze(
    rows: ImportedRow[],
    validCategoryIds: string[]
  ): Promise<RowAnalysis[]> {
    const config = readAIConfig();
    if (!config.enabled || !config.apiKey || config.provider === 'mock') {
      return new MockQuestionAnalyzer().analyze(rows, validCategoryIds);
    }

    try {
      const provider = getAIProvider(config);
      const aiQuestions = rows.map((r) => ({
        question: r.question,
        answer: r.answer,
        difficulty: 'medium' as QuestionDifficulty,
        category: r.category,
      }));
      const result = await provider.analyzeQuestions({ questions: aiQuestions }, config);

      // Merge AI quality insights with the local structural analysis.
      const validSet = new Set(validCategoryIds);
      const earlier: Array<{ question: string; rowIndex: number }> = [];

      return rows.map((row, i): RowAnalysis => {
        const flags: AnalysisFlag[] = [];
        const isEmpty =
          !row.question.trim() && !row.answer.trim() && !row.category.trim();
        const hasQuestion = row.question.trim().length > 0;
        const hasAnswer = row.answer.trim().length > 0;
        const hasValidCategory =
          row.category.trim().length > 0 && validSet.has(row.category.trim());

        if (isEmpty) flags.push('empty-row');
        if (!isEmpty && !hasAnswer) flags.push('missing-answer');
        if (!isEmpty && row.category.trim().length > 0 && !hasValidCategory)
          flags.push('invalid-category');

        const breakdown = analyzeDifficulty(row.question);
        const decision = decideDifficulty(row.question, breakdown);

        const quality = hasQuestion
          ? analyzeQuality(row.question, row.answer)
          : { flags: [], score: 100, notes: 'صف فارغ' };

        let dupVerdict: DuplicateVerdict | null = null;
        if (hasQuestion) {
          dupVerdict = findDuplicate(row.question, earlier);
          if (dupVerdict) {
            if (dupVerdict.kind === 'exact') {
              if (!flags.includes('duplicate')) flags.push('duplicate');
            } else {
              if (!flags.includes('similar')) flags.push('similar');
            }
          }
          earlier.push({ question: row.question, rowIndex: row.rowIndex });
        }

        let status: AnalysisStatus = 'accepted';
        if (flags.includes('empty-row')) {
          status = 'rejected';
        } else if (flags.includes('duplicate')) {
          status = 'duplicate';
        } else if (
          flags.includes('invalid-category') ||
          flags.includes('missing-answer') ||
          flags.includes('similar')
        ) {
          status = 'needs-review';
        } else if (isSevereQuality(quality.flags)) {
          status = 'needs-review';
        } else if (decision.confidence < MANUAL_REVIEW_CONFIDENCE) {
          status = 'needs-manual-review';
        }

        // If the AI flagged issues for this row, surface them.
        const aiIssue = result.issues[i] ?? '';
        const aiNotes = aiIssue ? `${quality.notes} | ${aiIssue}` : quality.notes;

        return {
          rowIndex: row.rowIndex,
          status,
          flags,
          difficultySuggestion: decision,
          duplicateOf: dupVerdict?.duplicateOf,
          similarity: dupVerdict?.score,
          duplicateKind: dupVerdict?.kind ?? undefined,
          difficultyBreakdown: breakdown,
          explanation: decision.explanation,
          quality: { ...quality, notes: aiNotes },
        };
      });
    } catch {
      return new MockQuestionAnalyzer().analyze(rows, validCategoryIds);
    }
  }
}
