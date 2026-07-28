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
import {
  SYSTEM_INSTRUCTION,
  analyzePrompt,
  classifyPrompt,
  generatePrompt,
  generateWordsPrompt,
  improvePrompt,
  coachPrompt,
  diagnosticsPrompt,
  TEST_CONNECTION_PROMPT,
} from '../prompts';
import { parseJsonLoose, fetchWithTimeout } from '../json-utils';

/**
 * OpenRouter provider — OpenAI-compatible chat completions API.
 *
 * OpenRouter routes to many models behind a single endpoint. The transport is
 * shared with the Groq provider via `callOpenAICompatible` so the chat logic
 * lives in exactly one place. Falls back to mock intelligence when disabled or
 * misconfigured.
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const TIMEOUT_MS = 30_000;

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

/** OpenAI-compatible chat call with timeout + retry. Shared by OpenRouter + Groq. */
export async function callOpenAICompatible(
  baseUrl: string,
  prompt: string,
  config: AIProviderConfig,
  extraHeaders: Record<string, string> = {},
  systemInstruction: string = SYSTEM_INSTRUCTION
): Promise<string> {
  const url = `${baseUrl}/chat/completions`;
  const messages = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: prompt },
  ];
  const body = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    response_format: { type: 'json_object' },
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
            ...extraHeaders,
          },
          body: JSON.stringify(body),
        },
        TIMEOUT_MS
      );
      const json = (await res.json()) as ChatResponse;
      if (!res.ok || json.error) {
        const msg = json.error?.message ?? `API error ${res.status}`;
        lastError = new Error(msg);
        if (res.status === 400 || res.status === 401 || res.status === 403) throw lastError;
        if (attempt === 0) continue;
        throw lastError;
      }
      return json.choices?.[0]?.message?.content ?? '';
    } catch (e) {
      lastError = e as Error;
      if (attempt === 1) throw lastError;
      continue;
    }
  }
  throw lastError ?? new Error('Unknown error');
}

export class OpenRouterProvider implements AIProvider {
  readonly id = 'openrouter' as const;
  readonly name = 'OpenRouter';
  needsKey = true;

  async testConnection(config: AIProviderConfig): Promise<{ ok: boolean; message: string; detectedModel?: string }> {
    if (!config.apiKey) return { ok: false, message: 'مفت API مطلوب لـ OpenRouter.' };
    try {
      await callOpenAICompatible(OPENROUTER_BASE, TEST_CONNECTION_PROMPT, config, {
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      });
      return { ok: true, message: 'تم الاتصال بـ OpenRouter بنجاح.', detectedModel: config.model };
    } catch (e) {
      return { ok: false, message: `فشل الاتصال: ${(e as Error).message}` };
    }
  }

  async analyzeQuestions(request: AnalyzeRequest, config: AIProviderConfig): Promise<AnalyzeResult> {
    if (!config.enabled || !config.apiKey) return mockAnalyze(request);
    try {
      const text = await callOpenAICompatible(OPENROUTER_BASE, analyzePrompt(request), config);
      return parseJsonLoose<AnalyzeResult>(text) ?? mockAnalyze(request);
    } catch {
      return mockAnalyze(request);
    }
  }

  async generateQuestions(request: GenerateRequest, config: AIProviderConfig): Promise<ReturnType<typeof mockGenerate>> {
    if (!config.enabled || !config.apiKey) return mockGenerate(request);
    try {
      const text = await callOpenAICompatible(OPENROUTER_BASE, generatePrompt(request), config);
      return parseJsonLoose<ReturnType<typeof mockGenerate>>(text) ?? mockGenerate(request);
    } catch {
      return mockGenerate(request);
    }
  }

  async improveQuestion(request: ImproveRequest, config: AIProviderConfig): Promise<ImproveResult> {
    if (!config.enabled || !config.apiKey) return mockImprove(request);
    try {
      const text = await callOpenAICompatible(OPENROUTER_BASE, improvePrompt(request), config);
      return parseJsonLoose<ImproveResult>(text) ?? mockImprove(request);
    } catch {
      return mockImprove(request);
    }
  }

  async coachQuestions(request: CoachRequest, config: AIProviderConfig): Promise<CoachResult> {
    if (!config.enabled || !config.apiKey) return mockCoach(request);
    try {
      const text = await callOpenAICompatible(OPENROUTER_BASE, coachPrompt(request), config);
      return parseJsonLoose<CoachResult>(text) ?? mockCoach(request);
    } catch {
      return mockCoach(request);
    }
  }

  async runDiagnostics(request: DiagnosticsRequest, config: AIProviderConfig): Promise<DiagnosticsResult> {
    if (!config.enabled || !config.apiKey) return mockDiagnostics(request);
    try {
      const text = await callOpenAICompatible(OPENROUTER_BASE, diagnosticsPrompt(request), config);
      return parseJsonLoose<DiagnosticsResult>(text) ?? mockDiagnostics(request);
    } catch {
      return mockDiagnostics(request);
    }
  }

  async generateWords(request: GenerateWordsRequest, config: AIProviderConfig): Promise<GenerateWordsResult> {
    if (!config.enabled || !config.apiKey) return mockGenerateWords(request);
    try {
      const text = await callOpenAICompatible(OPENROUTER_BASE, generateWordsPrompt(request), config);
      return parseJsonLoose<GenerateWordsResult>(text) ?? mockGenerateWords(request);
    } catch {
      return mockGenerateWords(request);
    }
  }

  async classifyRow(request: ClassifyRequest, config: AIProviderConfig): Promise<ClassifyResult> {
    if (!config.enabled || !config.apiKey) return mockClassify(request.question, request.existingCategories);
    try {
      const text = await callOpenAICompatible(OPENROUTER_BASE, classifyPrompt(request), config);
      return parseJsonLoose<ClassifyResult>(text) ?? mockClassify(request.question, request.existingCategories);
    } catch {
      return mockClassify(request.question, request.existingCategories);
    }
  }
}
