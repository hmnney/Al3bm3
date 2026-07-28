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
 *  - Dynamic model discovery (never hardcodes outdated model names)
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

interface GeminiModelsResponse {
  models?: Array<{
    name: string;
    supportedGenerationMethods?: string[];
  }>;
  error?: { message?: string };
}

/** Cache of the last discovered valid model, keyed by apiKey. */
let cachedModel: string | null = null;
let cachedForKey: string | null = null;

/** Extract text content from a Gemini response. */
function extractText(res: GeminiResponse): string {
  return res.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/**
 * Dynamically discover available Gemini models via GET /v1beta/models.
 * Returns the model name (e.g. "gemini-2.0-flash") or null on failure.
 *
 * Selection priority:
 *   1. The configured model, if it exists and supports generateContent.
 *   2. The first model whose name contains "flash" (fast, cheap, good for JSON).
 *   3. The first model that supports generateContent.
 */
async function resolveModel(config: AIProviderConfig): Promise<string | null> {
  if (!config.apiKey) return null;

  // Return cache if the key hasn't changed.
  if (cachedModel && cachedForKey === config.apiKey) return cachedModel;

  const url = `${GEMINI_BASE}/models?key=${encodeURIComponent(config.apiKey)}`;
  try {
    const res = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      10_000
    );
    const json = (await res.json()) as GeminiModelsResponse;
    if (!res.ok || json.error || !json.models) return null;

    const models = json.models;
    const supportsGen = (m: (typeof models)[number]) =>
      m.supportedGenerationMethods?.includes('generateContent');

    // 1. Configured model still valid?
    if (config.model) {
      const match = models.find(
        (m) =>
          m.name === `models/${config.model}` ||
          m.name === config.model
      );
      if (match && supportsGen(match)) {
        const name = match.name.replace(/^models\//, '');
        cachedModel = name;
        cachedForKey = config.apiKey;
        return name;
      }
    }

    // 2. First Flash model.
    const flash = models.find(
      (m) => supportsGen(m) && m.name.toLowerCase().includes('flash')
    );
    if (flash) {
      const name = flash.name.replace(/^models\//, '');
      cachedModel = name;
      cachedForKey = config.apiKey;
      return name;
    }

    // 3. First model that supports generateContent.
    const any = models.find(supportsGen);
    if (any) {
      const name = any.name.replace(/^models\//, '');
      cachedModel = name;
      cachedForKey = config.apiKey;
      return name;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Core transport: call Gemini generateContent with timeout + retry.
 * Never throws — returns null on failure so callers can fall back to mock.
 */
async function callGemini(
  prompt: string,
  config: AIProviderConfig
): Promise<string | null> {
  const model = await resolveModel(config);
  if (!model) return null;

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
        const msg = json.error?.message ?? `Gemini error ${res.status}`;
        // Don't retry on auth/client errors — they'll just fail again.
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          // If the model is invalid, invalidate cache so next call re-discovers.
          if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('not supported')) {
            cachedModel = null;
            cachedForKey = null;
          }
          return null;
        }
        if (attempt === 0) continue;
        return null;
      }
      return extractText(json);
    } catch {
      if (attempt === 1) return null;
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
  ): Promise<{ ok: boolean; message: string; detectedModel?: string }> {
    if (!config.apiKey) {
      return { ok: false, message: 'مفتاح API مطلوب لـ Gemini.' };
    }

    // Dynamically discover available models.
    const model = await resolveModel(config);
    if (!model) {
      return {
        ok: false,
        message: 'تعذّر العثور على أي نموذج متاح. تحقق من صلاحية المفتاح.',
      };
    }

    // Test the real selected model with a minimal generateContent call.
    const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const body = {
      contents: [{ parts: [{ text: 'أجب بـ {"status":"ok"} فقط.' }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 32,
        responseMimeType: 'application/json',
      },
    };

    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        15_000
      );
      const json = (await res.json()) as GeminiResponse;
      if (!res.ok || json.error) {
        const msg = json.error?.message ?? `HTTP ${res.status}`;
        return { ok: false, message: `فشل الاتصال: ${msg}` };
      }
      return {
        ok: true,
        message: `تم الاتصال بـ Gemini بنجاح (النموذج: ${model}).`,
        detectedModel: model,
      };
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
