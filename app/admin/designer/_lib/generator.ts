import type { PointValue, QuestionDifficulty } from '@/lib/types';
import type {
  DesignerRequest,
  GeneratedQuestion,
  QuestionStyle,
} from './types';
import { difficultyLabel, difficultyToPoints } from './types';

/**
 * Mocked question generator. Produces locally-generated questions in seven
 * styles, each with difficulty-aware content and an Arabic "why this
 * difficulty" explanation. No external AI.
 *
 * Templates are parameterized by topic + keywords so the same style yields
 * different questions across regenerations. The generator is deterministic
 * given a seed index, so regenerate/improve produce predictable variations.
 */

let tempCounter = 0;
function nextTempId(): string {
  tempCounter += 1;
  return `gen-${Date.now().toString(36)}-${tempCounter}`;
}

/** Split keywords into an array of trimmed tokens. */
function keywordsOf(raw: string): string[] {
  return raw
    .split(/[،,.\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Pick a deterministic item from an array by index. */
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

/** Difficulty-aware answer detail phrases. */
const ANSWER_DETAIL: Record<QuestionDifficulty, string[]> = {
  easy: ['بشكل مباشر', 'الاسم المعروف', 'الإجابة الأشهر'],
  medium: ['مع ذكر السنة', 'مع تحديد التفصيل', 'بدقة متوسطة'],
  hard: ['مع التبرير', 'مع ربط الحدث بما سبقه', 'بإيراد التفاصيل النادرة'],
};

/** Difficulty-aware question difficulty qualifiers. */
const DIFF_QUALIFIERS: Record<QuestionDifficulty, string[]> = {
  easy: ['ببساطة', 'بشكل مباشر', 'بدون تعقيد'],
  medium: ['بدقة', 'مع تفصيل', 'بتحديد أدق'],
  hard: ['بعمق', 'مع تحليل', 'بربط الأحداث'],
};

/**
 * Build the "why this difficulty was selected" explanation. Explains the
 * reasoning signals in everyday Arabic.
 */
function difficultyReasoning(
  d: QuestionDifficulty,
  style: QuestionStyle,
  topic: string
): string {
  const label = difficultyLabel(d);
  if (d === 'easy') {
    return (
      `صعوبة ${label} (250 نقطة): السؤال يعتمد على معرفة عامة مباشرة عن "${topic}" ` +
      `بأسلوب ${styleLabelShort(style)}، ولا يتطلب خطوات استنتاج أو استدعاء تفاصيل دقيقة من الذاكرة. ` +
      `الإجابة معروفة لشريحة واسعة ولذا تُناسب مستوى المبتدئين.`
    );
  }
  if (d === 'medium') {
    return (
      `صعوبة ${label} (500 نقطة): السؤال يطلب تحديد تفصيل محدد عن "${topic}" ` +
      `بأسلوب ${styleLabelShort(style)}، ويتطلب استدعاء معرفة دقيقة (سنة/رقم/اسم) مع خطوة استنتاج واحدة. ` +
      `الإجابة معروفة لعشاق المجال لكنها ليست عامة تماماً، فتُناسب المستوى المتوسط.`
    );
  }
  return (
    `صعوبة ${label} (750 نقطة): السؤال يطلب معرفة جماهيرية عميقة عن "${topic}" ` +
    `بأسلوب ${styleLabelShort(style)}، مع خطوات استنتاج متعددة وربط بين تفاصيل نادرة. ` +
    `الإجابة لا يعرفها إلا المتابع المتمرس، فتُناسب المستوى المتقدم.`
  );
}

function styleLabelShort(s: QuestionStyle): string {
  const map: Record<QuestionStyle, string> = {
    general: 'معرفة عامة',
    'guess-image': 'تعرّف من الصورة',
    'guess-player': 'تعرّف اللاعب',
    audio: 'تعرّف من الصوت',
    video: 'تعرّف من الفيديو',
    story: 'إكمال القصة',
    'order-events': 'ترتيب الأحداث',
  };
  return map[s];
}

/** Template generators per style. Each returns {question, answer}. */
const STYLE_TEMPLATES: Record<
  QuestionStyle,
  (req: DesignerRequest, i: number, kw: string[]) => { question: string; answer: string }
> = {
  general: (req, i, kw) => {
    const t = req.topic;
    const k = kw.length ? pick(kw, i) : 'المعرفة';
    const q = pick(
      [
        `ما العاصمة التي ترتبط بـ "${t}"؟`,
        `ما أبرز إنجاز مرتبط بـ "${t}" ${k ? `في مجال ${k}` : ''}؟`,
        `من الشخصية الأشهر المرتبطة بـ "${t}"؟`,
        `ما المعلومة الأكثر تداولاً عن "${t}"؟`,
        `ما الحدث التاريخي الأبرز في "${t}"؟`,
      ],
      i
    );
    const a = pick(
      [
        `الإجابة المرتبطة بـ ${t} ${k ? `(${k})` : ''}`,
        `الإنجاز الأشهر في ${t}`,
        `الشخصية البارزة في ${t}`,
      ],
      i
    );
    return { question: q, answer: a };
  },

  'guess-image': (req, i, kw) => {
    const t = req.topic;
    const a = kw.length ? pick(kw, i) : `عنصر من ${t}`;
    return {
      question: `خمّن ما الذي يظهر في الصورة المرتبطة بـ "${t}" (إجابة واحدة).`,
      answer: a,
      mediaHint: `صورة توضيحية لـ ${a}`,
    } as { question: string; answer: string; mediaHint?: string };
  },

  'guess-player': (req, i, kw) => {
    const t = req.topic;
    const a = kw.length ? pick(kw, i) : `لاعب بارز في ${t}`;
    return {
      question: `من اللاعب/الشخصية المرتبط بـ "${t}" ${pick(DIFF_QUALIFIERS[req.targetDifficulty], i)}؟`,
      answer: a,
      mediaHint: `صورة لاحتفالية أو ملامح ${a}`,
    } as { question: string; answer: string; mediaHint?: string };
  },

  audio: (req, i, kw) => {
    const t = req.topic;
    const a = kw.length ? pick(kw, i) : `مقطع صوتي من ${t}`;
    return {
      question: `استمع إلى المقطع الصوتي من "${t}" وخمّن المصدر ${pick(DIFF_QUALIFIERS[req.targetDifficulty], i)}.`,
      answer: a,
      mediaHint: `مقطع صوتي لـ ${a}`,
    } as { question: string; answer: string; mediaHint?: string };
  },

  video: (req, i, kw) => {
    const t = req.topic;
    const a = kw.length ? pick(kw, i) : `مقطع من ${t}`;
    return {
      question: `شاهد المقطع من "${t}" وحدد المشهد ${pick(DIFF_QUALIFIERS[req.targetDifficulty], i)}.`,
      answer: a,
      mediaHint: `مقطع فيديو لـ ${a}`,
    } as { question: string; answer: string; mediaHint?: string };
  },

  story: (req, i, kw) => {
    const t = req.topic;
    const k = kw.length ? pick(kw, i) : 'بداية القصة';
    return {
      question: `أكمل القصة: "في "${t}"، ${k}... ثم ماذا حدث ${pick(DIFF_QUALIFIERS[req.targetDifficulty], i)}؟`,
      answer: `النهاية المتوقعة للقصة المتعلقة بـ ${t}`,
    };
  },

  'order-events': (req, i, kw) => {
    const t = req.topic;
    const k = kw.length ? pick(kw, i) : 'الأحداث';
    return {
      question: `رتّب الأحداث التالية المتعلقة بـ "${t}" ${pick(DIFF_QUALIFIERS[req.targetDifficulty], i)}: ${k}، ثم ${pick(ANSWER_DETAIL[req.targetDifficulty], i)}.`,
      answer: `الترتيب الصحيح لأحداث ${t}`,
    };
  },
};

/** Generate one question from a request + variation index. */
export function generateOne(
  req: DesignerRequest,
  i: number
): GeneratedQuestion {
  const kw = keywordsOf(req.keywords);
  const tpl = STYLE_TEMPLATES[req.style](req, i, kw);
  const points: PointValue = difficultyToPoints(req.targetDifficulty);
  return {
    tempId: nextTempId(),
    question: tpl.question,
    answer: tpl.answer,
    difficulty: req.targetDifficulty,
    points,
    categoryId: req.categoryId,
    style: req.style,
    reasoning: difficultyReasoning(req.targetDifficulty, req.style, req.topic),
    mediaHint: (tpl as { mediaHint?: string }).mediaHint,
    status: 'pending',
  };
}

/** Generate a batch of questions. */
export function generateBatch(req: DesignerRequest): GeneratedQuestion[] {
  const n = Math.max(1, Math.min(20, req.count));
  return Array.from({ length: n }, (_, i) => generateOne(req, i));
}

/**
 * Regenerate a single question with a fresh variation index. Keeps the same
 * request context but produces a different template pick + new temp id.
 */
export function regenerateOne(
  _q: GeneratedQuestion,
  req: DesignerRequest
): GeneratedQuestion {
  // Use a large random offset so the variation differs from the original.
  const variation = Math.floor(Math.random() * 1000) + 100;
  return generateOne(req, variation);
}

/**
 * Improve a question's wording without changing difficulty. Tightens phrasing
 * and adds a uniqueness qualifier to reduce ambiguity.
 */
export function improveOne(
  q: GeneratedQuestion,
  _req: DesignerRequest
): GeneratedQuestion {
  const tighter = q.question
    .replace(/\s+/g, ' ')
    .replace(/\?{2,}$/, '؟')
    .trim();
  const improved = tighter.endsWith('؟')
    ? tighter
    : `${tighter} (إجابة واحدة فريدة)؟`;
  return {
    ...q,
    tempId: nextTempId(),
    question: improved,
    reasoning:
      q.reasoning +
      ' — حُسّنت الصياغة لتقليل الغموض ومنع تعدد الإجابات دون تغيير الصعوبة.',
    status: 'pending',
  };
}
