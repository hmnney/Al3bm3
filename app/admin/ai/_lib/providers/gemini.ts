import type {
  AIProvider,
  AIProviderConfig,
  AIQuestion,
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
import {
  SYSTEM_INSTRUCTION,
  analyzePrompt,
  generatePrompt,
  improvePrompt,
  coachPrompt,
  diagnosticsPrompt,
  TEST_CONNECTION_PROMPT,
} from '../prompts';
import { parseJsonLoose, fetchWithTimeout } from '../json-utils';

/**
 * Gemini provider — calls the official Google Gemini REST API.
 *
 * IMPORTANT: the project NEVER imports Gemini directly outside this file. The
 * factory is the only entry point. When AI is disabled or the API key is
 * missing, this provider gracefully falls back to local mock intelligence so
 * the app never breaks.
 *
 * Reliability features:
 *  - Timeout (30s default)
 *  - Retry once on failure
 *  - JSON validation + automatic repair
 *  - responseMimeType: 'application/json' for structured output
 *  - Graceful fallback to Mock AI on any error
 *
 * Safety:
 *  - The API key is never logged or exposed in error messages.
 *  - Only the prompt payload is sent to the API — no project metadata.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 30_000;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
}

/** Extract text content from a Gemini response. */
function extractText(res: GeminiResponse): string {
  return res.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/**
 * Core transport: call Gemini generateContent with timeout + retry.
 * Never throws — returns null on failure so callers can fall back to mock.
 */
async function callGemini(
  prompt: string,
  config: AIProviderConfig
): Promise<string | null> {
  const model = config.model || 'gemini-1.5-flash';
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
      responseMimeType: 'application/json',
    },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        TIMEOUT_MS
      );
      const json = (await res.json()) as GeminiResponse;
      if (!res.ok || json.error) {
        // Don't retry on auth errors — they'll just fail again.
        const msg = json.error?.message ?? `Gemini error ${res.status}`;
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new Error(msg);
        }
        // Retry on server errors / rate limits.
        if (attempt === 0) continue;
        throw new Error(msg);
      }
      return extractText(json);
    } catch (e) {
      if (attempt === 1) {
        // Return null on second failure — caller falls back to mock.
        return null;
      }
      // First failure: retry.
      continue;
    }
  }
  return null;
}

/** Call Gemini and parse JSON, falling back to mock on any failure. */
async function callAndParse<T>(
  prompt: string,
  config: AIProviderConfig,
  fallback: T
): Promise<T> {
  if (!config.enabled || !config.apiKey) return fallback;
  const text = await callGemini(prompt, config);
  if (text === null) return fallback;
  const parsed = parseJsonLoose<T>(text);
  return parsed ?? fallback;
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const;
  readonly name = 'Gemini';
  needsKey = true;

  async testConnection(
    config: AIProviderConfig
  ): Promise<{ ok: boolean; message: string }> {
    if (!config.apiKey) {
      return { ok: false, message: 'مفتاح API مطلوب لـ Gemini.' };
    }

    // Use the models list endpoint for a lightweight connectivity check.
    const model = config.model || 'gemini-1.5-flash';
    const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}?key=${encodeURIComponent(config.apiKey)}`;

    try {
      const res = await fetchWithTimeout(
        url,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        10_000
      );
      const json = (await res.json()) as GeminiResponse & { name?: string };
      if (!res.ok || json.error) {
        const msg = json.error?.message ?? `HTTP ${res.status}`;
        return { ok: false, message: `فشل الاتصال: ${msg}` };
      }
      return { ok: true, message: 'تم الاتصال بـ Gemini بنجاح.' };
    } catch (e) {
      return { ok: false, message: `فشل الاتصال: ${(e as Error).message}` };
    }
  }

  async analyzeQuestions(
    request: AnalyzeRequest,
    config: AIProviderConfig
  ): Promise<AnalyzeResult> {
    return callAndParse<AnalyzeResult>(
      analyzePrompt(request),
      config,
      mockAnalyze(request)
    );
  }

  async generateQuestions(
    request: GenerateRequest,
    config: AIProviderConfig
  ): Promise<AIQuestion[]> {
    return callAndParse<AIQuestion[]>(
      generatePrompt(request),
      config,
      mockGenerate(request)
    );
  }

  async improveQuestion(
    request: ImproveRequest,
    config: AIProviderConfig
  ): Promise<ImproveResult> {
    return callAndParse<ImproveResult>(
      improvePrompt(request),
      config,
      mockImprove(request)
    );
  }

  async coachQuestions(
    request: CoachRequest,
    config: AIProviderConfig
  ): Promise<CoachResult> {
    return callAndParse<CoachResult>(
      coachPrompt(request),
      config,
      mockCoach(request)
    );
  }

  async runDiagnostics(
    request: DiagnosticsRequest,
    config: AIProviderConfig
  ): Promise<DiagnosticsResult> {
    return callAndParse<DiagnosticsResult>(
      diagnosticsPrompt(request),
      config,
      mockDiagnostics(request)
    );
  }
}
