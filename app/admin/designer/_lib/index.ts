import type { DesignerEngine } from './types';
import { MockDesignerEngine } from './mock-designer';

/**
 * Designer factory — the single swap point for the AI Question Designer.
 *
 * The Designer is a completely isolated service. To plug in a real AI model
 * later (OpenAI, a local LLM, a Supabase edge function, etc.), create a class
 * that implements `DesignerEngine` and return it here instead of the mock.
 * No UI code needs to change.
 */

let active: DesignerEngine | null = null;

export function getDesigner(): DesignerEngine {
  if (!active) {
    // Future: replace with a real AI-backed designer, e.g.
    //   active = new OpenAiDesignerEngine({ apiKey: ... });
    active = new MockDesignerEngine();
  }
  return active;
}

/** Reset the cached designer (useful for tests / future config switches). */
export function resetDesigner(): void {
  active = null;
}

// Public surface of the designer package.
export type {
  DesignerEngine,
  DesignerRequest,
  GeneratedQuestion,
  QuestionStyle,
} from './types';
export {
  STYLE_LABELS,
  STYLE_ICONS,
  difficultyLabel,
  difficultyToPoints,
} from './types';
