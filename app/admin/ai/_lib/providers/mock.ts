import type {
  AIProvider,
  AIProviderConfig,
  AIQuestion,
  AnalyzeRequest,
  AnalyzeResult,
  ClassifyRequest,
  ClassifyResult,
  CoachRequest,
  CoachResult,
  DiagnosticsRequest,
  DiagnosticsResult,
  GenerateRequest,
  GenerateWordsRequest,
  GenerateWordsResult,
  ImproveRequest,
  ImproveResult,
} from '../types';
import {
  mockAnalyze,
  mockCoach,
  mockDiagnostics,
  mockGenerate,
  mockGenerateWords,
  mockImprove,
  mockClassify,
} from '../mock-intelligence';

/**
 * Mock AI provider — fully local, no network, no API key. Uses the shared mock
 * intelligence helpers. This is the default provider and the fallback when AI
 * is disabled or misconfigured.
 */
export class MockAIProvider implements AIProvider {
  readonly id = 'mock' as const;
  readonly name = 'Mock AI';
  needsKey = false;

  async testConnection(_config: AIProviderConfig): Promise<{ ok: boolean; message: string; detectedModel?: string }> {
    return { ok: true, message: 'المحرك المحلي يعمل دائماً — لا يحتاج اتصالاً.', detectedModel: 'mock-local' };
  }

  async analyzeQuestions(request: AnalyzeRequest, _config: AIProviderConfig): Promise<AnalyzeResult> {
    return mockAnalyze(request);
  }

  async generateQuestions(request: GenerateRequest, _config: AIProviderConfig): Promise<AIQuestion[]> {
    return mockGenerate(request);
  }

  async improveQuestion(request: ImproveRequest, _config: AIProviderConfig): Promise<ImproveResult> {
    return mockImprove(request);
  }

  async coachQuestions(request: CoachRequest, _config: AIProviderConfig): Promise<CoachResult> {
    return mockCoach(request);
  }

  async runDiagnostics(request: DiagnosticsRequest, _config: AIProviderConfig): Promise<DiagnosticsResult> {
    return mockDiagnostics(request);
  }

  async generateWords(request: GenerateWordsRequest, _config: AIProviderConfig): Promise<GenerateWordsResult> {
    return mockGenerateWords(request);
  }

  async classifyRow(request: ClassifyRequest, _config: AIProviderConfig): Promise<ClassifyResult> {
    return mockClassify(request.question, request.existingCategories);
  }
}
