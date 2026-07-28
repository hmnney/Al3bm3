import type {
  DesignerEngine,
  DesignerRequest,
  GeneratedQuestion,
} from './types';
import {
  generateBatch,
  improveOne,
  regenerateOne,
} from './generator';

/**
 * Mock designer engine — orchestrates the local generator. Simulates async
 * generation work so the UI can show a loading state.
 *
 * To replace with a real AI model later, write a new class implementing
 * `DesignerEngine` and point the factory in `index.ts` at it. No UI changes.
 */
export class MockDesignerEngine implements DesignerEngine {
  readonly name = 'مصمم أسئلة محلي';

  async generate(request: DesignerRequest): Promise<GeneratedQuestion[]> {
    await new Promise((r) => setTimeout(r, 700));
    return generateBatch(request);
  }

  async regenerate(
    question: GeneratedQuestion,
    request: DesignerRequest
  ): Promise<GeneratedQuestion> {
    await new Promise((r) => setTimeout(r, 400));
    return regenerateOne(question, request);
  }

  async improve(
    question: GeneratedQuestion,
    request: DesignerRequest
  ): Promise<GeneratedQuestion> {
    await new Promise((r) => setTimeout(r, 400));
    return improveOne(question, request);
  }
}
