import type { DiagnosticsEngine } from './types';
import { MockDiagnosticsEngine } from './mock-engine';
import { AIDiagnosticsEngine } from './ai-engine';
import { loadSettings } from '../../_lib/settings-store';

/**
 * Diagnostics factory — the single swap point for the System Diagnostics
 * backend. Returns the AI-backed engine when AI is enabled and configured,
 * otherwise the local mock engine. No UI changes.
 */

let active: DiagnosticsEngine | null = null;

export function getDiagnostics(): DiagnosticsEngine {
  if (!active) {
    const ai = loadSettings().ai;
    if (ai.enabled && ai.apiKey && ai.provider !== 'mock') {
      active = new AIDiagnosticsEngine();
    } else {
      active = new MockDiagnosticsEngine();
    }
  }
  return active;
}

export function resetDiagnostics(): void {
  active = null;
}

export type {
  DiagnosticsEngine,
  DiagnosticsResult,
  DiagnosticsStats,
  DiagnosticIssue,
  DiagnosticSuggestion,
  HealthScore,
  IssueSeverity,
  SuggestionPriority,
} from './types';
export { analyze } from './analyzer';
