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
  ModelInfo,
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
  coachPrompt,
  diagnosticsPrompt,
  generatePrompt,
  generateWordsPrompt,
  improvePrompt,
} from '../prompts';
import { parseJsonLoose, fetchWithTimeout } from '../json-utils';

/**
 * Gemini provider — calls the Google AI Studio Gemini API.
 *
 * Authentication uses the `x-goog-api-key` header.
 *
 * Model selection is 100% dynamic. The provider NEVER hardcodes any model
 * name. It calls GET /v1beta/models, reads what Google returns, and tries each
 * model that supports generateContent until one actually works at runtime
 * (Google may list a model as available but reject it with "no longer
 * available to new users" — so we probe, not just filter).
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

function extractText(res: GeminiResponse): string {
  return res.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function authHeadersWithKey(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };
}

/**
 * Fetch the list of models from Google's API.
 * Strips the "models/" prefix so names are bare (e.g. "gemini-2.5-flash").
 * Annotates each with whether it supports generateContent.
 */
async function discoverModels(apiKey: string): Promise<ModelInfo[] | null> {
  const url = `${GEMINI_BASE}/models`;
  console.log('[GEMINI] Discovering models:', url);
  try {
    const res = await fetchWithTimeout(
      url,
      { method: 'GET', headers: authHeadersWithKey(apiKey) },
      10_000
    );
    const bodyText = await res.text();
    console.log('[GEMINI] Models list HTTP:', res.status, res.statusText);
    console.log('[GEMINI] Models list body (first 2000 chars):', bodyText.slice(0, 2000));

    let json: GeminiModelsResponse;
    try {
      json = JSON.parse(bodyText) as GeminiModelsResponse;
    } catch {
      console.log('[GEMINI] Models list JSON parse failed');
      return null;
    }

    if (!res.ok || json.error || !json.models) {
      console.log('[GEMINI] Models list error:', json.error?.message);
      return null;
    }

    const result = json.models.map((m) => {
      const methods = m.supportedGenerationMethods ?? [];
      const canGenerate = methods.includes('generateContent');
      const bareName = m.name.replace(/^models\//, '');
      return {
        name: bareName,
        canGenerate,
        rejectionReason: canGenerate
          ? undefined
          : `لا يدعم generateContent (يدعم: ${methods.join(', ') || 'لا شيء'})`,
      } satisfies ModelInfo;
    });

    console.log('[GEMINI] Discovered models:', result.map((m) => `${m.name} (${m.canGenerate ? 'usable' : m.rejectionReason})`).join(', '));
    return result;
  } catch (e) {
    console.log('[GEMINI] Models discovery exception:', (e as Error).message);
    return null;
  }
}

/**
 * Probe a single model with a minimal generateContent call.
 * Returns true if the model responded successfully.
 */
async function probeModel(
  apiKey: string,
  modelName: string
): Promise<boolean> {
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(modelName)}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: 'أجب بـ {"status":"ok"} فقط.' }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 32,
      responseMimeType: 'application/json',
    },
  };

  console.log('[GEMINI] Probing model:', modelName);
  console.log('[GEMINI] Request URL:', url);
  console.log('[GEMINI] Request body:', JSON.stringify(body));

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: authHeadersWithKey(apiKey),
        body: JSON.stringify(body),
      },
      15_000
    );
    const bodyText = await res.text();
    console.log('[GEMINI] Response HTTP:', res.status, res.statusText);
    console.log('[GEMINI] Response body:', bodyText.slice(0, 2000));

    if (!res.ok) {
      let json: GeminiResponse | null = null;
      try { json = JSON.parse(bodyText) as GeminiResponse; } catch { /* ignore */ }
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      console.log(`[GEMINI] Model ${modelName} rejected: ${msg}`);
      return false;
    }
    console.log(`[GEMINI] Model ${modelName} accepted!`);
    return true;
  } catch (e) {
    console.log(`[GEMINI] Model ${modelName} exception:`, (e as Error).message);
    return false;
  }
}

/**
 * Discover models, then probe each one that supports generateContent until we
 * find one that actually works at runtime. Returns the model name or null.
 *
 * The saved config.model is NEVER trusted — we always probe fresh.
 */
async function discoverWorkingModel(
  apiKey: string
): Promise<{ model: string; allModels: ModelInfo[] } | null> {
  const allModels = await discoverModels(apiKey);
  if (!allModels) return null;

  const usable = allModels.filter((m) => m.canGenerate);
  if (usable.length === 0) {
    console.log('[GEMINI] No models support generateContent');
    return null;
  }

  // Try each usable model until one works.
  for (const candidate of usable) {
    const works = await probeModel(apiKey, candidate.name);
    if (works) {
      console.log('[GEMINI] Selected working model:', candidate.name);
      return { model: candidate.name, allModels };
    }
  }

  console.log('[GEMINI] No model passed the probe');
  return null;
}

/**
 * Core transport: discover a working model, then call generateContent.
 * Never throws — returns null on failure so callers can fall back to mock.
 */
async function callGemini(
  prompt: string,
  config: AIProviderConfig
): Promise<string | null> {
  if (!config.apiKey) return null;

  const discovered = await discoverWorkingModel(config.apiKey);
  if (!discovered) return null;
  const { model } = discovered;

  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
      responseMimeType: 'application/json',
    },
  };

  console.log('[GEMINI] generateContent URL:', url);
  console.log('[GEMINI] Using model:', model);
  console.log('[GEMINI] Request body:', JSON.stringify(body).slice(0, 500));

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: authHeadersWithKey(config.apiKey),
          body: JSON.stringify(body),
        },
        TIMEOUT_MS
      );
      const bodyText = await res.text();
      console.log('[GEMINI] Response HTTP:', res.status);
      console.log('[GEMINI] Response body (first 2000 chars):', bodyText.slice(0, 2000));

      if (!res.ok) {
        let json: GeminiResponse | null = null;
        try { json = JSON.parse(bodyText) as GeminiResponse; } catch { /* ignore */ }
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          return null;
        }
        if (attempt === 0) continue;
        return null;
      }
      const json = JSON.parse(bodyText) as GeminiResponse;
      return extractText(json);
    } catch {
      if (attempt === 1) return null;
      continue;
    }
  }
  return null;
}

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
  ): Promise<{
    ok: boolean;
    message: string;
    detectedModel?: string;
    availableModels?: ModelInfo[];
    selectedModel?: string;
  }> {
    if (!config.apiKey) {
      return { ok: false, message: 'مفتاح API مطلوب لـ Gemini.' };
    }

    // Discover models — NEVER use config.model. Always probe fresh.
    const discovered = await discoverWorkingModel(config.apiKey);

    if (!discovered) {
      // Even if no model passed the probe, return the list for debug.
      const allModels = await discoverModels(config.apiKey);
      return {
        ok: false,
        message: 'لم يتم العثور على نموذج يعمل. راجع لوحة التشخيص بالأسفل.',
        availableModels: allModels ?? undefined,
      };
    }

    return {
      ok: true,
      message: `تم الاتصال بـ Gemini بنجاح (النموذج: ${discovered.model}).`,
      detectedModel: discovered.model,
      availableModels: discovered.allModels,
      selectedModel: discovered.model,
    };
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

  async generateWords(
    request: GenerateWordsRequest,
    config: AIProviderConfig
  ): Promise<GenerateWordsResult> {
    return callAndParse<GenerateWordsResult>(
      generateWordsPrompt(request),
      config,
      mockGenerateWords(request)
    );
  }

  async classifyRow(
    request: ClassifyRequest,
    config: AIProviderConfig
  ): Promise<ClassifyResult> {
    return callAndParse<ClassifyResult>(
      classifyPrompt(request),
      config,
      mockClassify(request.question, request.existingCategories)
    );
  }
}
