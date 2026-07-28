import type { AdminCategory, AdminQuestion } from '../../_lib/types';
import type { DiagnosticsEngine, DiagnosticsResult } from './types';
import { analyze } from './analyzer';
import { MockDiagnosticsEngine } from './mock-engine';
import { getAIProvider, type AIProviderConfig } from '../../ai/_lib';
import { loadSettings } from '../../_lib/settings-store';

/**
 * AI-backed diagnostics engine adapter.
 *
 * Runs the local statistical analyzer first (always — it's fast and produces
 * the structured stats/breakdown the UI needs), then asks the AI provider for
 * additional issues and suggestions. Falls back to the mock engine when:
 *  - AI is disabled
 *  - No API key is set
 *  - The provider call fails
 *
 * The UI only ever talks to the `DiagnosticsEngine` interface.
 */

function readAIConfig(): AIProviderConfig {
  return loadSettings().ai;
}

export class AIDiagnosticsEngine implements DiagnosticsEngine {
  readonly name = 'محلل تشخيص بالذكاء الاصطناعي';

  async analyze(
    categories: AdminCategory[],
    questions: AdminQuestion[],
    hiddenIds: string[],
    disabledIds: string[]
  ): Promise<DiagnosticsResult> {
    const local = analyze(categories, questions, hiddenIds, disabledIds);

    const config = readAIConfig();
    if (!config.enabled || !config.apiKey || config.provider === 'mock') {
      return local;
    }

    try {
      const provider = getAIProvider(config);
      const aiQuestions = questions.map((q) => ({
        question: q.question,
        answer: q.answer,
        difficulty: q.difficulty,
        category: q.categoryId,
      }));
      const aiResult = await provider.runDiagnostics(
        { categories: categories.length, questions: aiQuestions },
        config
      );

      // Merge AI-generated issues and suggestions into the local result.
      const aiIssues = aiResult.issues.map((msg) => ({
        severity: 'warning' as const,
        message: msg,
      }));
      const aiSuggestions = aiResult.suggestions.map((msg) => ({
        priority: 'medium' as const,
        message: msg,
      }));

      return {
        stats: local.stats,
        health: {
          ...local.health,
          score: aiResult.healthScore > 0 ? aiResult.healthScore : local.health.score,
        },
        issues: [...local.issues, ...aiIssues],
        suggestions: [...local.suggestions, ...aiSuggestions],
      };
    } catch {
      return local;
    }
  }
}
