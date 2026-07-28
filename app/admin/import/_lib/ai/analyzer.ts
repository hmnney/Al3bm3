import type { QuestionAnalyzer } from './types';
import { MockQuestionAnalyzer } from './mock-analyzer';
import { AIQuestionAnalyzer } from './ai-analyzer';
import { loadSettings } from '../../../_lib/settings-store';

/**
 * Analyzer factory — the single swap point for the AI analysis backend.
 *
 * Returns the AI-backed analyzer when AI is enabled and configured, otherwise
 * the local mock analyzer. The Import Wizard UI only ever talks to the
 * `QuestionAnalyzer` interface, so no UI code changes.
 */

let active: QuestionAnalyzer | null = null;

export function getAnalyzer(): QuestionAnalyzer {
  if (!active) {
    const ai = loadSettings().ai;
    if (ai.enabled && ai.apiKey && ai.provider !== 'mock') {
      active = new AIQuestionAnalyzer();
    } else {
      active = new MockQuestionAnalyzer();
    }
  }
  return active;
}

/** Reset the cached analyzer (useful for tests / future config switches). */
export function resetAnalyzer(): void {
  active = null;
}
