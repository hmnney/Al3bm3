import type {
  AIQuestion,
  AnalyzeRequest,
  AnalyzeResult,
  CoachRequest,
  CoachResult,
  DiagnosticsRequest,
  DiagnosticsResult,
  GenerateRequest,
  GenerateWordsRequest,
  ImproveRequest,
  ImproveResult,
} from './types';
import type { QuestionDifficulty } from '@/lib/types';

/**
 * Shared mock intelligence used by the Mock provider AND as a fallback when a
 * real provider is disabled or misconfigured. Pure functions, fully local.
 */

const DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
};

/** Detect duplicates by normalized question text. */
export function detectDuplicates(questions: AIQuestion[]): number {
  const seen = new Set<string>();
  let dupes = 0;
  for (const q of questions) {
    const key = q.question.trim().toLowerCase();
    if (seen.has(key)) dupes++;
    else seen.add(key);
  }
  return dupes;
}

/** Count questions with empty/short answers. */
export function countMissingAnswers(questions: AIQuestion[]): number {
  return questions.filter((q) => !q.answer || q.answer.trim().length < 2).length;
}

/** Count questions with very short text. */
export function countShortQuestions(questions: AIQuestion[]): number {
  return questions.filter((q) => q.question.trim().length < 12).length;
}

/** Compute a 0–100 quality score. */
export function qualityScore(questions: AIQuestion[]): number {
  if (questions.length === 0) return 0;
  const dupes = detectDuplicates(questions);
  const missing = countMissingAnswers(questions);
  const short = countShortQuestions(questions);
  const penalties = (dupes * 15 + missing * 10 + short * 5) / questions.length;
  return Math.max(0, Math.round(100 - penalties * 100));
}

/** Mock analyze. */
export function mockAnalyze(request: AnalyzeRequest): AnalyzeResult {
  const { questions } = request;
  const duplicates = detectDuplicates(questions);
  const missingAnswers = countMissingAnswers(questions);
  const shortQuestions = countShortQuestions(questions);
  const score = qualityScore(questions);
  const issues: string[] = [];
  if (duplicates > 0) issues.push(`يوجد ${duplicates} سؤال مكرر.`);
  if (missingAnswers > 0) issues.push(`يوجد ${missingAnswers} سؤال بدون إجابة.`);
  if (shortQuestions > 0) issues.push(`يوجد ${shortQuestions} سؤال بصياغة قصيرة جداً.`);
  return {
    total: questions.length,
    duplicates,
    missingAnswers,
    shortQuestions,
    qualityScore: score,
    issues,
  };
}

/** Mock generate. */
export function mockGenerate(request: GenerateRequest): AIQuestion[] {
  const { topic, difficulty, count } = request;
  const templates = [
    `ما العاصمة المرتبطة بـ "${topic}"؟`,
    `ما أبرز حدث في "${topic}"؟`,
    `من الشخصية الأشهر في "${topic}"؟`,
    `ما الإنجاز الأكبر في "${topic}"؟`,
    `ما المعلومة الأكثر تداولاً عن "${topic}"؟`,
    `ما السنة المرتبطة بأهم حدث في "${topic}"؟`,
    `ما العنصر الأبرز المرتبط بـ "${topic}"؟`,
    `ما التفصيلة النادرة عن "${topic}"؟`,
  ];
  return Array.from({ length: count }, (_, i) => ({
    question: templates[i % templates.length],
    answer: `إجابة نموذجية عن ${topic} (${DIFFICULTY_LABEL[difficulty]})`,
    difficulty,
    category: request.category,
  }));
}

/** Mock improve. */
export function mockImprove(request: ImproveRequest): ImproveResult {
  const q = request.question;
  const tighter = q.question.replace(/\s+/g, ' ').trim();
  const improved = tighter.endsWith('؟') ? tighter : `${tighter}؟`;
  return {
    question: improved,
    answer: q.answer,
    changes: ['تم تقليص المسافات الزائدة', 'أُضيف علامة استفهام واضحة'],
  };
}

/** Mock coach. */
export function mockCoach(request: CoachRequest): CoachResult {
  const { questions } = request;
  const suggestions: CoachResult['suggestions'] = [];
  const dupes = detectDuplicates(questions);
  if (dupes > 0) {
    suggestions.push({
      type: 'remove',
      message: `يوجد ${dupes} سؤال مكرر — يُنصح بحذفها لتنويع المحتوى.`,
    });
  }
  const missing = countMissingAnswers(questions);
  if (missing > 0) {
    suggestions.push({
      type: 'balance',
      message: `${missing} سؤال بدون إجابة — أكملها لتحسين الجودة.`,
    });
  }
  const easy = questions.filter((q) => q.difficulty === 'easy').length;
  const hard = questions.filter((q) => q.difficulty === 'hard').length;
  if (easy === 0) {
    suggestions.push({ type: 'add', message: 'أضف أسئلة سهلة (250 نقطة) لتحقيق توازن الصعوبة.' });
  }
  if (hard === 0) {
    suggestions.push({ type: 'add', message: 'أضف أسئلة صعبة (750 نقطة) لتحقيق توازن الصعوبة.' });
  }
  return {
    suggestions,
    report: `تحليل ${questions.length} سؤال: الجودة ${qualityScore(questions)}/100، التكرار ${dupes}، بدون إجابة ${missing}.`,
  };
}

/** Mock generate words. */
export function mockGenerateWords(request: GenerateWordsRequest): string[] {
  const { topic, count } = request;
  const base = [
    'عنصر ١', 'عنصر ٢', 'عنصر ٣', 'عنصر ٤', 'عنصر ٥',
    'عنصر ٦', 'عنصر ٧', 'عنصر ٨', 'عنصر ٩', 'عنصر ١٠',
    'عنصر ١١', 'عنصر ١٢', 'عنصر ١٣', 'عنصر ١٤', 'عنصر ١٥',
    'عنصر ١٦', 'عنصر ١٧', 'عنصر ١٨', 'عنصر ١٩', 'عنصر ٢٠',
    'عنصر ٢١', 'عنصر ٢٢', 'عنصر ٢٣', 'عنصر ٢٤', 'عنصر ٢٥',
  ];
  return base.slice(0, Math.min(count, base.length)).map((w) => `${w} (${topic})`);
}

/** Mock classify — local heuristic for Smart Import when AI is disabled. */
export function mockClassify(
  question: string,
  existingCategories: string[]
): { category: string; difficulty: QuestionDifficulty; points: 250 | 500 | 750; confidence: number } {
  const q = question.trim();
  let difficulty: QuestionDifficulty = 'medium';
  let confidence = 60;

  if (q.length < 25) {
    difficulty = 'easy';
    confidence = 70;
  } else if (q.length > 80 || q.includes('؟') === false) {
    difficulty = 'hard';
    confidence = 55;
  }

  const points = difficulty === 'easy' ? 250 : difficulty === 'medium' ? 500 : 750;

  let category = 'عام';
  if (existingCategories.length > 0) {
    category = existingCategories[0];
  }

  return { category, difficulty, points, confidence };
}

/** Mock diagnostics. */
export function mockDiagnostics(request: DiagnosticsRequest): DiagnosticsResult {
  const { questions } = request;
  const score = qualityScore(questions);
  const issues: string[] = [];
  const suggestions: string[] = [];
  if (score < 80) issues.push(`درجة جودة المحتوى ${score} — تحتاج تحسين.`);
  if (detectDuplicates(questions) > 0) {
    issues.push(`يوجد تكرار في الأسئلة.`);
    suggestions.push('احذف الأسئلة المكررة لتنويع المحتوى.');
  }
  if (countMissingAnswers(questions) > 0) {
    issues.push(`يوجد أسئلة بدون إجابة.`);
    suggestions.push('أكمل الإجابات الناقصة.');
  }
  if (issues.length === 0) issues.push('لا توجد مشكلات بارزة.');
  if (suggestions.length === 0) suggestions.push('استمر في إضافة محتوى متنوع.');
  return { healthScore: score, issues, suggestions };
}
