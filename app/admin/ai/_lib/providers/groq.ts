import type {
  AIProvider,
  AIProviderConfig,
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
import { callOpenAICompatible } from './openrouter';
import {
  SYSTEM_INSTRUCTION,
  analyzePrompt,
  classifyPrompt,
  generatePrompt,
  generateWordsPrompt,
  improvePrompt,
  coachPrompt,
  diagnosticsPrompt,
} from '../prompts';
import { parseJsonLoose } from '../json-utils';

/**
 * Groq provider — OpenAI-compatible chat completions API on Groq's endpoint.
 * Reuses the shared `callOpenAICompatible` transport from the OpenRouter
 * provider and the shared prompt templates. Falls back to mock intelligence
 * when disabled or misconfigured.
 */

const GROQ_BASE = 'https://api.groq.com/openai/v1';

export class GroqProvider implements AIProvider {
  readonly id = 'groq' as const;
  readonly name = 'Groq';
  needsKey = true;

  async testConnection(config: AIProviderConfig): Promise<{ ok: boolean; message: string; detectedModel?: string }> {
    if (!config.apiKey) return { ok: false, message: 'مفت API مطلوب لـ Groq.' };
    try {
      await callOpenAICompatible(GROQ_BASE, 'أجب بكلمة "موافق" فقط.', config);
      return { ok: true, message: 'تم الاتصال بـ Groq بنجاح.', detectedModel: config.model };
    } catch (e) {
      return { ok: false, message: `فشل الاتصال: ${(e as Error).message}` };
    }
  }

  async analyzeQuestions(request: AnalyzeRequest, config: AIProviderConfig): Promise<AnalyzeResult> {
    if (!config.enabled || !config.apiKey) return mockAnalyze(request);
    try {
      const text = await callOpenAICompatible(GROQ_BASE, analyzePrompt(request), config, undefined, SYSTEM_INSTRUCTION);
      return parseJsonLoose<AnalyzeResult>(text) ?? mockAnalyze(request);
    } catch {
      return mockAnalyze(request);
    }
  }

  async generateQuestions(request: GenerateRequest, config: AIProviderConfig): Promise<ReturnType<typeof mockGenerate>> {
    if (!config.enabled || !config.apiKey) return mockGenerate(request);
    try {
      const text = await callOpenAICompatible(GROQ_BASE, generatePrompt(request), config, undefined, SYSTEM_INSTRUCTION);
      return parseJsonLoose<ReturnType<typeof mockGenerate>>(text) ?? mockGenerate(request);
    } catch {
      return mockGenerate(request);
    }
  }

  async improveQuestion(request: ImproveRequest, config: AIProviderConfig): Promise<ImproveResult> {
    if (!config.enabled || !config.apiKey) return mockImprove(request);
    try {
      const text = await callOpenAICompatible(GROQ_BASE, improvePrompt(request), config, undefined, SYSTEM_INSTRUCTION);
      return parseJsonLoose<ImproveResult>(text) ?? mockImprove(request);
    } catch {
      return mockImprove(request);
    }
  }

  async coachQuestions(request: CoachRequest, config: AIProviderConfig): Promise<CoachResult> {
    if (!config.enabled || !config.apiKey) return mockCoach(request);
    try {
      const text = await callOpenAICompatible(GROQ_BASE, coachPrompt(request), config, undefined, SYSTEM_INSTRUCTION);
      return parseJsonLoose<CoachResult>(text) ?? mockCoach(request);
    } catch {
      return mockCoach(request);
    }
  }

  async runDiagnostics(request: DiagnosticsRequest, config: AIProviderConfig): Promise<DiagnosticsResult> {
    if (!config.enabled || !config.apiKey) return mockDiagnostics(request);
    try {
      const text = await callOpenAICompatible(GROQ_BASE, diagnosticsPrompt(request), config, undefined, SYSTEM_INSTRUCTION);
      return parseJsonLoose<DiagnosticsResult>(text) ?? mockDiagnostics(request);
    } catch {
      return mockDiagnostics(request);
    }
  }

  async generateWords(request: GenerateWordsRequest, config: AIProviderConfig): Promise<GenerateWordsResult> {
    if (!config.enabled || !config.apiKey) return mockGenerateWords(request);
    try {
      const text = await callOpenAICompatible(GROQ_BASE, generateWordsPrompt(request), config, undefined, SYSTEM_INSTRUCTION);
      return parseJsonLoose<GenerateWordsResult>(text) ?? mockGenerateWords(request);
    } catch {
      return mockGenerateWords(request);
    }
  }

  async classifyRow(request: ClassifyRequest, config: AIProviderConfig): Promise<ClassifyResult> {
    if (!config.enabled || !config.apiKey) return mockClassify(request.question, request.existingCategories);
    try {
      const text = await callOpenAICompatible(GROQ_BASE, classifyPrompt(request), config, undefined, SYSTEM_INSTRUCTION);
      return parseJsonLoose<ClassifyResult>(text) ?? mockClassify(request.question, request.existingCategories);
    } catch {
      return mockClassify(request.question, request.existingCategories);
    }
  }
}
