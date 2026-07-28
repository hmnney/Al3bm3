import type { DesignerEngine } from './types';
import { MockDesignerEngine } from './mock-designer';
import { AIDesignerEngine } from './ai-designer';
import { loadSettings } from '../../_lib/settings-store';

/**
 * Designer factory — the single swap point for the AI Question Designer.
 *
 * Returns the AI-backed engine when AI is enabled and configured, otherwise the
 * local mock engine. The Designer UI only ever talks to the `DesignerEngine`
 * interface, so no UI code changes.
 */

let active: DesignerEngine | null = null;

export function getDesigner(): DesignerEngine {
  if (!active) {
    const ai = loadSettings().ai;
    if (ai.enabled && ai.apiKey && ai.provider !== 'mock') {
      active = new AIDesignerEngine();
    } else {
      active = new MockDesignerEngine();
    }
  }
  return active;
}

/** Reset the cached designer (useful for tests / config switches). */
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
