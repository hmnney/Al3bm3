import type {
  AIProvider,
  AIProviderConfig,
  AnalyzeRequest,
  AnalyzeResult,
  CoachRequest,
  CoachResult,
  DiagnosticsRequest,
  DiagnosticsResult,
  GenerateRequest,
  ImproveRequest,
  ImproveResult,
} from '../types';
import {
  mockAnalyze,
  mockCoach,
  mockDiagnostics,
  mockGenerate,
  mockImprove,
} from '../mock-intelligence';
import { callOpenAICompatible } from './openrouter';
import {
  SYSTEM_INSTRUCTION,
  analyzePrompt,
  generatePrompt,
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

  async testConnection(config: AIProviderConfig): Promise<{ ok: boolean; message: string }> {
    if (!config.apiKey) return { ok: false, message: 'مفت API مطلوب لـ Groq.' };
    try {
      await callOpenAICompatible(GROQ_BASE, 'أجب بكلمة "موافق" فقط.', config);
      return { ok: true, message: 'تم الاتصال بـ Groq بنجاح.' };
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
}
