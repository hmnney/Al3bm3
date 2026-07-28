import { getAIProvider, type AIProviderConfig, type AIQuestion } from '../../ai/_lib';
import { loadSettings } from '../../_lib/settings-store';
import type {
  GenerationConfig,
  GenerationProgress,
  BuilderQuestion,
} from './types';
import {
  difficultySplit,
  POINTS_FOR_DIFFICULTY,
  builderId,
} from './types';

/**
 * Question Database Builder — generation engine.
 *
 * Orchestrates AI question generation with:
 *  - Difficulty split based on the selected mode (mixed/easy/medium/hard).
 *  - Batching: large counts are split into batches to avoid token limits.
 *  - Automatic retry on failure (up to MAX_RETRIES per batch).
 *  - Progress reporting via callback.
 *
 * The engine is pure-async and has no React dependency — it can be unit-tested
 * or reused by future plugins (Images, Audio, Posters, Video) by passing a
 * different config and consuming the BuilderQuestion[] output.
 */

const MAX_RETRIES = 3;
const BATCH_SIZE = 25;

export interface GenerateCallbacks {
  onProgress?: (p: GenerationProgress) => void;
}

/** Run a full generation pass. Returns generated questions or throws. */
export async function generateQuestions(
  config: GenerationConfig,
  callbacks?: GenerateCallbacks
): Promise<BuilderQuestion[]> {
  const aiConfig = loadSettings().ai;
  const provider = getAIProvider(aiConfig);

  const split = difficultySplit(config.mode, config.count);
  const batches = buildBatches(split, config);

  const total = config.count;
  let done = 0;
  const all: BuilderQuestion[] = [];

  callbacks?.onProgress?.({
    done: 0,
    total,
    pct: 0,
    phase: 'preparing',
    message: 'يُجهّز المحرك…',
  });

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    let attempt = 0;
    let batchQuestions: AIQuestion[] | null = null;

    while (attempt < MAX_RETRIES && !batchQuestions) {
      try {
        if (attempt > 0) {
          callbacks?.onProgress?.({
            done,
            total,
            pct: Math.round((done / total) * 100),
            phase: 'retrying',
            message: `إعادة المحاولة ${attempt}/${MAX_RETRIES} للدفعة ${i + 1}…`,
          });
        } else {
          callbacks?.onProgress?.({
            done,
            total,
            pct: Math.round((done / total) * 100),
            phase: 'generating',
            message: `يولّد الدفعة ${i + 1} من ${batches.length}…`,
          });
        }

        batchQuestions = await provider.generateQuestions(
          {
            topic: config.categoryName,
            difficulty: batch.difficulty,
            count: batch.count,
            category: config.categoryName,
          },
          aiConfig
        );
      } catch (err) {
        attempt++;
        if (attempt >= MAX_RETRIES) {
          callbacks?.onProgress?.({
            done,
            total,
            pct: Math.round((done / total) * 100),
            phase: 'error',
            message: `تعذّر توليد الدفعة ${i + 1} بعد ${MAX_RETRIES} محاولات`,
          });
          throw new Error(
            `فشل توليد الدفعة ${i + 1}: ${(err as Error).message || 'خطأ غير معروف'}`
          );
        }
        // Brief backoff before retry.
        await sleep(500 * attempt);
      }
    }

    if (!batchQuestions || batchQuestions.length === 0) continue;

    for (const q of batchQuestions) {
      const difficulty = q.difficulty || batch.difficulty;
      all.push({
        tempId: builderId(),
        categoryId: config.categoryId,
        question: q.question,
        answer: q.answer,
        difficulty,
        points: POINTS_FOR_DIFFICULTY[difficulty],
      });
      done++;
      if (done % 5 === 0) {
        callbacks?.onProgress?.({
          done,
          total,
          pct: Math.round((done / total) * 100),
          phase: 'generating',
          message: `تم توليد ${done} من ${total}…`,
        });
      }
    }
  }

  // Trim to exact count (AI may return slightly more/less per batch).
  const result = all.slice(0, total);

  callbacks?.onProgress?.({
    done: result.length,
    total,
    pct: 100,
    phase: 'done',
    message: `اكتمل التوليد — ${result.length} سؤالاً`,
  });

  return result;
}

/** Regenerate a single question. Returns one BuilderQuestion. */
export async function regenerateQuestion(
  config: GenerationConfig,
  difficulty: BuilderQuestion['difficulty'],
  callbacks?: GenerateCallbacks
): Promise<BuilderQuestion> {
  const aiConfig = loadSettings().ai;
  const provider = getAIProvider(aiConfig);

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      callbacks?.onProgress?.({
        done: 0,
        total: 1,
        pct: 0,
        phase: attempt > 0 ? 'retrying' : 'generating',
        message:
          attempt > 0
            ? `إعادة المحاولة ${attempt}/${MAX_RETRIES}…`
            : 'يولّد سؤالاً بديلاً…',
      });

      const qs = await provider.generateQuestions(
        {
          topic: config.categoryName,
          difficulty,
          count: 1,
          category: config.categoryName,
        },
        aiConfig
      );

      if (!qs || qs.length === 0) throw new Error('لم يُرجع المحرك أي سؤال');
      const q = qs[0];
      const d = q.difficulty || difficulty;

      callbacks?.onProgress?.({
        done: 1,
        total: 1,
        pct: 100,
        phase: 'done',
        message: 'تم توليد السؤال البديل',
      });

      return {
        tempId: builderId(),
        categoryId: config.categoryId,
        question: q.question,
        answer: q.answer,
        difficulty: d,
        points: POINTS_FOR_DIFFICULTY[d],
      };
    } catch (err) {
      attempt++;
      if (attempt >= MAX_RETRIES) {
        throw new Error(
          `فشل توليد السؤال البديل: ${(err as Error).message || 'خطأ غير معروف'}`
        );
      }
      await sleep(500 * attempt);
    }
  }

  // Unreachable, but satisfies the type checker.
  throw new Error('فشل غير متوقع');
}

// ---- internals ----

interface Batch {
  difficulty: BuilderQuestion['difficulty'];
  count: number;
}

function buildBatches(
  split: { easy: number; medium: number; hard: number },
  _config: GenerationConfig
): Batch[] {
  const batches: Batch[] = [];
  (['easy', 'medium', 'hard'] as const).forEach((diff) => {
    const n = split[diff];
    if (n === 0) return;
    let remaining = n;
    while (remaining > 0) {
      const size = Math.min(remaining, BATCH_SIZE);
      batches.push({ difficulty: diff, count: size });
      remaining -= size;
    }
  });
  return batches;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
