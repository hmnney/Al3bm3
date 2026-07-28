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

/**
 * Gemini provider — calls the Google Gemini REST API.
 *
 * IMPORTANT: the project NEVER imports Gemini directly outside this file. The
 * factory is the only entry point. When AI is disabled or the API key is
 * missing, this provider gracefully falls back to local mock intelligence so
 * the app never breaks.
 *
 * The actual network call is wrapped in a helper that builds the Gemini
 * `generateContent` request, sends it to the REST endpoint, and parses the
 * JSON response. All provider methods funnel through `callGemini` so the
 * transport logic lives in exactly one place.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
}

/** Build a structured prompt instructing Gemini to return JSON. */
function buildPrompt(
  task: string,
  payload: unknown
): string {
  return `${task}\n\nأعد النتيجة بصيغة JSON صالحة فقط بدون أي نص إضافي.\n\nالبيانات:\n${JSON.stringify(payload)}`;
}

/** Parse the text content from a Gemini response. */
function extractText(res: GeminiResponse): string {
  return res.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/** Attempt to parse JSON from a model response, tolerating code fences. */
function parseJsonLoose<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1]) as T;
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

/** Core transport: call Gemini generateContent. */
async function callGemini(
  prompt: string,
  config: AIProviderConfig
): Promise<string> {
  const model = config.model || 'gemini-1.5-flash';
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as GeminiResponse;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Gemini error ${res.status}`);
  }
  return extractText(json);
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const;
  readonly name = 'Gemini';
  needsKey = true;

  async testConnection(config: AIProviderConfig): Promise<{ ok: boolean; message: string }> {
    if (!config.apiKey) return { ok: false, message: 'مفت API مطلوب لـ Gemini.' };
    try {
      await callGemini('أجب بكلمة "موافق" فقط.', config);
      return { ok: true, message: 'تم الاتصال بـ Gemini بنجاح.' };
    } catch (e) {
      return { ok: false, message: `فشل الاتصال: ${(e as Error).message}` };
    }
  }

  async analyzeQuestions(request: AnalyzeRequest, config: AIProviderConfig): Promise<AnalyzeResult> {
    if (!config.enabled || !config.apiKey) return mockAnalyze(request);
    try {
      const text = await callGemini(
        buildPrompt('حلل الأسئلة التالية وأعد: total, duplicates, missingAnswers, shortQuestions, qualityScore (0-100), issues (مصفوفة عربية).', request),
        config
      );
      const parsed = parseJsonLoose<AnalyzeResult>(text);
      return parsed ?? mockAnalyze(request);
    } catch {
      return mockAnalyze(request);
    }
  }

  async generateQuestions(request: GenerateRequest, config: AIProviderConfig): Promise<ReturnType<typeof mockGenerate>> {
    if (!config.enabled || !config.apiKey) return mockGenerate(request);
    try {
      const text = await callGemini(
        buildPrompt('ولّد أسئلة بناءً على الطلب. أعد مصفوفة من {question, answer, difficulty}.', request),
        config
      );
      const parsed = parseJsonLoose<ReturnType<typeof mockGenerate>>(text);
      return parsed ?? mockGenerate(request);
    } catch {
      return mockGenerate(request);
    }
  }

  async improveQuestion(request: ImproveRequest, config: AIProviderConfig): Promise<ImproveResult> {
    if (!config.enabled || !config.apiKey) return mockImprove(request);
    try {
      const text = await callGemini(
        buildPrompt('حسّن صياغة السؤال. أعد {question, answer, changes (مصفوفة عربية)}.', request),
        config
      );
      const parsed = parseJsonLoose<ImproveResult>(text);
      return parsed ?? mockImprove(request);
    } catch {
      return mockImprove(request);
    }
  }

  async coachQuestions(request: CoachRequest, config: AIProviderConfig): Promise<CoachResult> {
    if (!config.enabled || !config.apiKey) return mockCoach(request);
    try {
      const text = await callGemini(
        buildPrompt('درّب الأسئلة: توازن، تنوع، إعادة صياغة. أعد {suggestions [{questionId?, type, message}], report}.', request),
        config
      );
      const parsed = parseJsonLoose<CoachResult>(text);
      return parsed ?? mockCoach(request);
    } catch {
      return mockCoach(request);
    }
  }

  async runDiagnostics(request: DiagnosticsRequest, config: AIProviderConfig): Promise<DiagnosticsResult> {
    if (!config.enabled || !config.apiKey) return mockDiagnostics(request);
    try {
      const text = await callGemini(
        buildPrompt('شخّص صحة المحتوى. أعد {healthScore (0-100), issues (مصفوفة), suggestions (مصفوفة)}.', request),
        config
      );
      const parsed = parseJsonLoose<DiagnosticsResult>(text);
      return parsed ?? mockDiagnostics(request);
    } catch {
      return mockDiagnostics(request);
    }
  }
}
