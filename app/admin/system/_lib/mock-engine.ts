import type { AdminCategory, AdminQuestion } from '../../_lib/types';
import type { DiagnosticsEngine, DiagnosticsResult } from './types';
import { analyze } from './analyzer';

/**
 * Mock diagnostics engine — wraps the pure analyzer and simulates async work
 * so the UI can show a loading state. To replace with a real AI backend later,
 * write a class implementing `DiagnosticsEngine` and swap it in `index.ts`.
 */
export class MockDiagnosticsEngine implements DiagnosticsEngine {
  readonly name = 'محلل تشخيص محلي';

  async analyze(
    categories: AdminCategory[],
    questions: AdminQuestion[],
    hiddenIds: string[],
    disabledIds: string[]
  ): Promise<DiagnosticsResult> {
    await new Promise((r) => setTimeout(r, 500));
    return analyze(categories, questions, hiddenIds, disabledIds);
  }
}
