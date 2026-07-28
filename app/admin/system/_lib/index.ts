import type { DiagnosticsEngine } from './types';
import { MockDiagnosticsEngine } from './mock-engine';

/**
 * Diagnostics factory — the single swap point for the System Diagnostics
 * backend. To plug in a real AI model later, create a class implementing
 * `DiagnosticsEngine` and return it here instead of the mock. No UI changes.
 */

let active: DiagnosticsEngine | null = null;

export function getDiagnostics(): DiagnosticsEngine {
  if (!active) {
    active = new MockDiagnosticsEngine();
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
