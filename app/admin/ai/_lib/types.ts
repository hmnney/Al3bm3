import type { QuestionDifficulty } from '@/lib/types';

/**
 * AI Provider Manager — provider interface and shared types.
 *
 * The project NEVER calls Gemini (or any provider) directly. Every call flows:
 *
 *   Game / Admin UI
 *     ↓
 *   AI Provider Manager (factory)
 *     ↓
 *   Selected AI Provider (implements AIProvider)
 *
 * Every provider implements exactly the same methods. To add a new provider,
 * create a class implementing `AIProvider` and register it in the factory.
 * No other code in the project changes.
 */

/** A question the AI works with. */
export interface AIQuestion {
  id?: string;
  question: string;
  answer: string;
  difficulty: QuestionDifficulty;
  category?: string;
}

/** Request to generate new questions. */
export interface GenerateRequest {
  topic: string;
  keywords?: string;
  difficulty: QuestionDifficulty;
  count: number;
  category?: string;
}

/** Request to analyze existing questions. */
export interface AnalyzeRequest {
  questions: AIQuestion[];
}

/** Result of analyzing questions. */
export interface AnalyzeResult {
  total: number;
  duplicates: number;
  missingAnswers: number;
  shortQuestions: number;
  qualityScore: number;
  issues: string[];
}

/** Request to improve a question's wording. */
export interface ImproveRequest {
  question: AIQuestion;
}

/** Result of improving a question. */
export interface ImproveResult {
  question: string;
  answer: string;
  changes: string[];
}

/** Request to coach questions (balance, diversity, rewrites). */
export interface CoachRequest {
  questions: AIQuestion[];
}

/** Result of coaching questions. */
export interface CoachResult {
  suggestions: Array<{
    questionId?: string;
    type: 'balance' | 'diversity' | 'rewrite' | 'add' | 'remove';
    message: string;
  }>;
  report: string;
}

/** Request for system diagnostics. */
export interface DiagnosticsRequest {
  categories: number;
  questions: AIQuestion[];
}

/** Result of diagnostics. */
export interface DiagnosticsResult {
  healthScore: number;
  issues: string[];
  suggestions: string[];
}

/** The provider configuration the admin controls. */
export interface AIProviderConfig {
  /** Which provider is active. */
  provider: AIProviderId;
  /** API key for the active provider (stored locally). */
  apiKey: string;
  /** Model identifier, e.g. 'gemini-1.5-flash'. */
  model: string;
  /** Sampling temperature 0–1. */
  temperature: number;
  /** Maximum output tokens. */
  maxTokens: number;
  /** Whether AI is enabled globally. */
  enabled: boolean;
}

/** The built-in provider ids. */
export type AIProviderId = 'gemini' | 'openrouter' | 'groq' | 'mock';

/** Arabic labels for providers. */
export const PROVIDER_LABELS: Record<AIProviderId, string> = {
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  mock: 'Mock AI',
};

/** Default model per provider. */
export const PROVIDER_DEFAULT_MODELS: Record<AIProviderId, string> = {
  gemini: 'gemini-1.5-flash',
  openrouter: 'openai/gpt-4o-mini',
  groq: 'llama-3.1-8b-instant',
  mock: 'mock-local',
};

/** Whether a provider needs an API key (mock does not). */
export const PROVIDER_NEEDS_KEY: Record<AIProviderId, boolean> = {
  gemini: true,
  openrouter: true,
  groq: true,
  mock: false,
};

/**
 * The interface every AI provider must implement. All methods are async and
 * return structured results — no raw text parsing at call sites. Future AI
 * methods are added here; existing providers implement them as no-ops until
 * they catch up.
 */
export interface AIProvider {
  readonly id: AIProviderId;
  readonly name: string;
  /** Whether this provider needs an API key. */
  needsKey: boolean;

  /** Test that the configured credentials/model work. */
  testConnection(config: AIProviderConfig): Promise<{
    ok: boolean;
    message: string;
    /** If the provider auto-detected a working model, it's returned here so
     *  the caller can persist it into settings. */
    detectedModel?: string;
  }>;

  /** Analyze existing questions for quality, duplicates, gaps. */
  analyzeQuestions(
    request: AnalyzeRequest,
    config: AIProviderConfig
  ): Promise<AnalyzeResult>;

  /** Generate new questions from a prompt. */
  generateQuestions(
    request: GenerateRequest,
    config: AIProviderConfig
  ): Promise<AIQuestion[]>;

  /** Improve a single question's wording and clarity. */
  improveQuestion(
    request: ImproveRequest,
    config: AIProviderConfig
  ): Promise<ImproveResult>;

  /** Coach a batch of questions — balance, diversity, rewrites. */
  coachQuestions(
    request: CoachRequest,
    config: AIProviderConfig
  ): Promise<CoachResult>;

  /** Run system-wide diagnostics over the question bank. */
  runDiagnostics(
    request: DiagnosticsRequest,
    config: AIProviderConfig
  ): Promise<DiagnosticsResult>;
}
