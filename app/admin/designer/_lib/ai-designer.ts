import type {
  DesignerEngine,
  DesignerRequest,
  GeneratedQuestion,
} from './types';
import { difficultyToPoints, difficultyLabel } from './types';
import {
  generateBatch,
  regenerateOne,
  improveOne,
} from './generator';
import { getAIProvider, type AIProviderConfig, type AIQuestion } from '../../ai/_lib';
import { loadSettings } from '../../_lib/settings-store';

/**
 * AI-backed Designer engine adapter.
 *
 * Delegates to the active AI provider (Gemini / Groq / OpenRouter) when AI is
 * enabled and configured. Falls back to the local mock generator when:
 *  - AI is disabled
 *  - No API key is set
 *  - The provider call fails for any reason
 *
 * This keeps the Designer UI completely unchanged — it only ever talks to the
 * `DesignerEngine` interface.
 */

let tempCounter = 0;
function nextTempId(): string {
  tempCounter += 1;
  return `gen-${Date.now().toString(36)}-${tempCounter}`;
}

function readAIConfig(): AIProviderConfig {
  return loadSettings().ai;
}

/** Map a raw AIQuestion into the GeneratedQuestion shape the UI expects. */
function toGenerated(
  q: AIQuestion,
  req: DesignerRequest,
  index: number
): GeneratedQuestion {
  return {
    tempId: nextTempId(),
    question: q.question,
    answer: q.answer,
    difficulty: q.difficulty,
    points: difficultyToPoints(q.difficulty),
    categoryId: req.categoryId,
    style: req.style,
    reasoning: `وُلّد بواسطة الذكاء الاصطناعي — صعوبة ${difficultyLabel(q.difficulty)} (${difficultyToPoints(q.difficulty)} نقطة).`,
    status: 'pending',
  };
}

export class AIDesignerEngine implements DesignerEngine {
  readonly name = 'مصمم أسئلة بالذكاء الاصطناعي';

  async generate(request: DesignerRequest): Promise<GeneratedQuestion[]> {
    const config = readAIConfig();
    if (!config.enabled || !config.apiKey || config.provider === 'mock') {
      return generateBatch(request);
    }
    try {
      const provider = getAIProvider(config);
      const aiQuestions = await provider.generateQuestions(
        {
          topic: request.topic,
          keywords: request.keywords,
          difficulty: request.targetDifficulty,
          count: request.count,
          category: request.categoryId,
        },
        config
      );
      if (!aiQuestions || aiQuestions.length === 0) return generateBatch(request);
      return aiQuestions.map((q, i) => toGenerated(q, request, i));
    } catch {
      return generateBatch(request);
    }
  }

  async regenerate(
    question: GeneratedQuestion,
    request: DesignerRequest
  ): Promise<GeneratedQuestion> {
    const config = readAIConfig();
    if (!config.enabled || !config.apiKey || config.provider === 'mock') {
      return regenerateOne(question, request);
    }
    try {
      const provider = getAIProvider(config);
      const aiQuestions = await provider.generateQuestions(
        {
          topic: request.topic,
          keywords: request.keywords,
          difficulty: request.targetDifficulty,
          count: 1,
          category: request.categoryId,
        },
        config
      );
      if (!aiQuestions || aiQuestions.length === 0) return regenerateOne(question, request);
      return toGenerated(aiQuestions[0], request, 0);
    } catch {
      return regenerateOne(question, request);
    }
  }

  async improve(
    question: GeneratedQuestion,
    request: DesignerRequest
  ): Promise<GeneratedQuestion> {
    const config = readAIConfig();
    if (!config.enabled || !config.apiKey || config.provider === 'mock') {
      return improveOne(question, request);
    }
    try {
      const provider = getAIProvider(config);
      const result = await provider.improveQuestion(
        {
          question: {
            question: question.question,
            answer: question.answer,
            difficulty: question.difficulty,
            category: request.categoryId,
          },
        },
        config
      );
      return {
        ...question,
        tempId: nextTempId(),
        question: result.question,
        answer: result.answer,
        reasoning:
          question.reasoning +
          ' — حُسّنت الصياغة بواسطة الذكاء الاصطناعي.',
        status: 'pending',
      };
    } catch {
      return improveOne(question, request);
    }
  }
}
