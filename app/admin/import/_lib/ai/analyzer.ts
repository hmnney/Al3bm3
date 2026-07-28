import type { QuestionAnalyzer } from './types';
import { MockQuestionAnalyzer } from './mock-analyzer';

/**
 * Analyzer factory — the single swap point for the AI analysis backend.
 *
 * The Import Wizard UI only ever calls `getAnalyzer()` and uses the returned
 * object through the `QuestionAnalyzer` interface. To plug in a real AI model
 * later (OpenAI, a local LLM, a Supabase edge function, etc.), create a class
 * that implements `QuestionAnalyzer` and return it here instead of the mock.
 * No UI code needs to change.
 *
 * The active analyzer is read once per import run and held in module scope so
 * the same instance is reused for the whole wizard.
 */

let active: QuestionAnalyzer | null = null;

export function getAnalyzer(): QuestionAnalyzer {
  if (!active) {
    // Future: replace with a real AI-backed analyzer, e.g.
    //   active = new OpenAiQuestionAnalyzer({ apiKey: ... });
    active = new MockQuestionAnalyzer();
  }
  return active;
}

/** Reset the cached analyzer (useful for tests / future config switches). */
export function resetAnalyzer(): void {
  active = null;
}
