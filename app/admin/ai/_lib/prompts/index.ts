/**
 * Shared prompt templates for all AI providers.
 *
 * Every provider (Gemini, OpenRouter, Groq, …) reuses these templates so the
 * prompt engineering lives in exactly one place. Each template returns a
 * string that instructs the model to answer in JSON only — no markdown, no
 * explanations outside JSON.
 *
 * The templates are provider-agnostic: they produce a plain-text prompt that
 * any chat / generateContent endpoint can consume.
 */

import type {
  AIQuestion,
  AnalyzeRequest,
  CoachRequest,
  DiagnosticsRequest,
  GenerateRequest,
  ImproveRequest,
} from '../types';

/**
 * The system instruction prepended to every prompt. Enforces JSON-only output
 * and Arabic responses.
 */
export const SYSTEM_INSTRUCTION = `أنت مساعد ذكي لإدارة بنك أسئلة لعبة ثقافية عربية.
قواعد صارمة:
1. أجب دائماً بصيغة JSON صالحة فقط.
2. لا تستخدم markdown (لا أكواد، لا علامات تنسيق).
3. لا تكتب أي نص خارج كائن JSON.
4. كل النصوص داخل JSON يجب أن تكون بالعربية.
5. التزم بالهيكل المطلوب تماماً.`;

/** Wrap a task instruction + payload into a single prompt string. */
function wrap(task: string, payload: unknown): string {
  return `${task}\n\nالبيانات (JSON):\n${JSON.stringify(payload)}`;
}

/** Prompt for analyzeQuestions(). */
export function analyzePrompt(request: AnalyzeRequest): string {
  return wrap(
    `حلّل الأسئلة التالية وأعد نتيجة بالهيكل التالي فقط:
{
  "total": number,
  "duplicates": number,
  "missingAnswers": number,
  "shortQuestions": number,
  "qualityScore": number (0-100),
  "issues": string[] (وصف المشكلات بالعربية)
}
احسب: عدد الأسئلة، التكرارات (نص متطابق)، الإجابات الناقصة، الأسئلة القصيرة جداً (< 12 حرف)، ودرجة جودة شاملة.`,
    request.questions
  );
}

/** Prompt for generateQuestions(). */
export function generatePrompt(request: GenerateRequest): string {
  return wrap(
    `ولّد ${request.count} أسئلة ${request.difficulty === 'easy' ? 'سهلة' : request.difficulty === 'medium' ? 'متوسطة' : 'صعبة'} عن موضوع "${request.topic}"${request.keywords ? ` مع التركيز على: ${request.keywords}` : ''}.
أعد مصفوفة بالهيكل التالي فقط:
[
  { "question": string, "answer": string, "difficulty": "${request.difficulty}", "category": "${request.category ?? ''}" }
]
الأسئلة يجب أن تكون متنوعة وواضحة ومناسبة للعبة ثقافية.`,
    { topic: request.topic, count: request.count, difficulty: request.difficulty }
  );
}

/** Prompt for improveQuestion(). */
export function improvePrompt(request: ImproveRequest): string {
  return wrap(
    `حسّن صياغة السؤال التالي ليكون أوضح وأدق. أعد النتيجة بالهيكل التالي فقط:
{
  "question": string (الصياغة المحسّنة),
  "answer": string (الإجابة المحسّنة إن لزم),
  "changes": string[] (قائمة التعديلات بالعربية)
}`,
    request.question
  );
}

/** Prompt for coachQuestions(). */
export function coachPrompt(request: CoachRequest): string {
  return wrap(
    `درّب الأسئلة التالية: حلّل التوازن، التنوع، والتكرار. أعد النتيجة بالهيكل التالي فقط:
{
  "suggestions": [
    { "questionId": string|null, "type": "balance"|"diversity"|"rewrite"|"add"|"remove", "message": string }
  ],
  "report": string (ملخص بالعربية)
}`,
    request.questions
  );
}

/** Prompt for runDiagnostics(). */
export function diagnosticsPrompt(request: DiagnosticsRequest): string {
  return wrap(
    `شخّص صحة بنك الأسئلة (${request.categories} تصنيف). أعد النتيجة بالهيكل التالي فقط:
{
  "healthScore": number (0-100),
  "issues": string[] (المشكلات بالعربية),
  "suggestions": string[] (التوصيات بالعربية)
}
احسب درجة الصحة بناءً على: التوازن بين التصنيفات، توزيع الصعوبة، التكرار، الإجابات الناقصة.`,
    { categories: request.categories, questions: request.questions }
  );
}

/** Prompt for testConnection() — minimal, just needs any valid response. */
export const TEST_CONNECTION_PROMPT = 'أجب بكلمة "موافق" فقط بصيغة JSON: {"status":"ok"}';
