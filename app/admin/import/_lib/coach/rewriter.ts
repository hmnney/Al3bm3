import type { QuestionDifficulty } from '@/lib/types';
import type {
  PointsTarget,
  QuestionCoaching,
  RewriteSuggestion,
  RewriteKind,
} from './types';
import type { ImportedRow, RowAnalysis } from '../ai/types';
import { tokenList } from '../ai/text-utils';

/**
 * Question rewriter — produces per-question coaching: an improvement
 * suggestion ("this question is too easy because...") plus suggested rewrites
 * targeting higher/balanced point tiers.
 *
 * Rules (per spec):
 *   current 250 (easy)  → suggest a 500 version + a 750 version (harder)
 *   current 500 (medium)→ suggest a better-balanced 500 + a 750 version
 *   current 750 (hard)  → suggest wording improvements only
 *
 * Every rewrite carries an explanation. All rewrites are intelligent mocked
 * coaching built from the analyzer's breakdown signals — no external AI.
 */

/** Map a difficulty to its game point tier. */
export function difficultyToPoints(d: QuestionDifficulty): PointsTarget {
  return d === 'easy' ? 250 : d === 'medium' ? 500 : 750;
}

/** Arabic label for a point tier. */
function pointsLabel(p: PointsTarget): string {
  return `${p} نقطة`;
}

/** Arabic label for a difficulty. */
function difficultyLabel(d: QuestionDifficulty): string {
  return d === 'easy' ? 'سهل' : d === 'medium' ? 'متوسط' : 'صعب';
}

/** Common Arabic question openers to strip when extracting the question core. */
const OPENERS = [
  'ما اسم', 'ما هو', 'ما هي', 'من هو', 'من هي', 'من هم', 'ماذا', 'كم',
  'كم عدد', 'في أي', 'متى', 'أين', 'لماذا', 'كيف', 'اي', 'أي', 'حدد', 'اذكر', 'أذكر',
];

/** Extract the "core" of a question by stripping leading openers. */
function coreOf(question: string): string {
  const q = question.trim();
  let best = q;
  OPENERS.forEach((op) => {
    if (q.startsWith(op)) {
      const rest = q.slice(op.length).replace(/^[\s:،]+/, '').trim();
      if (rest.length > 0 && rest.length < best.length) best = rest;
    }
  });
  return best || q;
}

/** Content tokens (non-stopword, length > 1) for signal-aware rewriting. */
const STOPWORDS = new Set([
  'من', 'ما', 'ماذا', 'كم', 'أين', 'متى', 'لماذا', 'كيف', 'هل', 'في', 'على',
  'عن', 'مع', 'و', 'أو', 'ثم', 'ال', 'هو', 'هي', 'هذا', 'هذه', 'ذلك', 'تلك',
  'التي', 'الذي', 'اسم', 'عدد', 'سنة', 'عام', 'وفي', 'التي', 'الذي', 'هو',
  'هي', 'ال', 'هذا', 'هذه', 'ذلك', 'تلك', 'من', 'في', 'على', 'عن', 'مع',
]);

function contentTokens(text: string): string[] {
  return tokenList(text).filter((t) => !STOPWORDS.has(t) && t.length > 1);
}

/**
 * Build the "this question is too easy/hard because..." suggestion from the
 * analyzer's breakdown + quality flags. Consumes the analysis; never rescores.
 */
function improvementSuggestion(
  row: ImportedRow,
  analysis: RowAnalysis
): string {
  const b = analysis.difficultyBreakdown;
  const q = analysis.quality;
  const diff = analysis.difficultySuggestion.difficulty;

  // Quality-driven reasons take priority when present.
  if (q && q.flags.length > 0) {
    if (q.flags.includes('too-easy')) {
      return 'هذا السؤال سهل جداً لأن الإجابة واضحة من نص السؤال أو لأنه قريب من أسئلة شائعة؛ يُنصح بإضافة قيد دقيق يرفع التحدي.';
    }
    if (q.flags.includes('too-vague')) {
      return 'صياغة السؤال غامضة ولا تحدد إجابة واحدة بدقة؛ يُنصح بتضييق النطاق وتحديد المطلوب بدقة قبل التفكير في رفع الصعوبة.';
    }
    if (q.flags.includes('multiple-answers')) {
      return 'السؤال قد يقبل أكثر من إجابة صحيحة؛ يُنصح بإضافة مُقيِّد يجعل الإجابة فريدة (الأول/الأخير/الوحيد).';
    }
    if (q.flags.includes('answer-mismatch')) {
      return 'الإجابة المدخلة لا تبدو متطابقة مع السؤال؛ يجب تصحيح الإجابة قبل إعادة صياغة السؤال.';
    }
    if (q.flags.includes('incomplete-question')) {
      return 'السؤال غير مكتمل ولا يمكن تحليل صعوبته بدقة؛ أكمل النص أولاً.';
    }
    if (q.flags.includes('incomplete-answer')) {
      return 'الإجابة غير مكتملة أو مؤقتة؛ أكمل الإجابة قبل توليد نسخ محسّنة.';
    }
  }

  if (!b) {
    return `السؤال مصنّف ${difficultyLabel(diff)} بثقة ${analysis.difficultySuggestion.confidence}%.`;
  }

  // Breakdown-driven reasons.
  if (diff === 'easy') {
    if (b.triviaSimilarityScore >= 60) {
      return `هذا السؤال سهل لأنه قريب من أسئلة شائعة ومألوفة (تشابه ${b.triviaSimilarityScore}/100)، ويتطلب معرفة عامة فقط دون تخصيص.`;
    }
    if (b.specificKnowledgeScore < 40) {
      return `هذا السؤال سهل لأنه يتطلب معرفة عامة (${b.generalKnowledgeScore}/100) دون معرفة متخصصة كافية، ولا يحتاج خطوات استنتاج تذكر.`;
    }
    return `هذا السؤال سهل لأنه يعتمد على التعرف المباشر دون استدعاء دقيق من الذاكرة (ذاكرة ${b.memoryScore}/100).`;
  }

  if (diff === 'medium') {
    if (b.ambiguityScore >= 55) {
      return `السؤال متوسط لكن صياغته غامضة نسبياً (غموض ${b.ambiguityScore}/100)؛ يمكن إعادة توازنه كـ 500 بتوضيح المطلوب بدقة دون رفع الصعوبة.`;
    }
    if (b.memoryScore < 45 && b.reasoningScore < 45) {
      return `السؤال متوسط ولكنه يقترب من السهل (ذاكرة ${b.memoryScore}/100، استنتاج ${b.reasoningScore}/100)؛ يُنصح بنسخة 500 أكثر توازناً تعتمد على استدعاء أدق.`;
    }
    return `السؤال متوسط ومتوازن نسبياً؛ يمكن تحسين توازنه كـ 500 أو رفعه إلى 750 بإضافة قيد جماهيري/تاريخي.`;
  }

  // hard
  if (b.ambiguityScore >= 50) {
    return `السؤال صعب لكن صياغته تحتاج تحسين لفظي لتقليل الغموض (${b.ambiguityScore}/100) دون تغيير الصعوبة.`;
  }
  return `السؤال صعب ومتقن (معرفة متخصصة ${b.specificKnowledgeScore}/100، جماهيرية ${b.fanKnowledgeScore}/100)؛ يُنصح بتحسين اللفظ فقط للحفاظ على مستوى 750.`;
}

/**
 * Choose a difficulty-raising clause based on which signal is weakest, so the
 * rewrite actually shores up the gap rather than adding random detail.
 */
function raisingClause(b: NonNullable<RowAnalysis['difficultyBreakdown']>): string {
  const signals: Array<{ score: number; clause: string }> = [
    { score: b.memoryScore, clause: 'مع ذكر السنة/الرقم بدقة' },
    { score: b.fanKnowledgeScore, clause: 'مع تحديد تفصيل جماهيري دقيق' },
    { score: b.reasoningScore, clause: 'واربط ذلك بالحدث الذي سبقه' },
    { score: b.specificKnowledgeScore, clause: 'وحدد التفاصيل المتخصصة النادرة' },
  ];
  signals.sort((a, c) => a.score - c.score);
  return signals[0].clause;
}

/** Build a "harder" rewrite targeting `targetPoints` (500 or 750). */
function harderRewrite(
  row: ImportedRow,
  analysis: RowAnalysis,
  targetPoints: PointsTarget
): RewriteSuggestion {
  const core = coreOf(row.question);
  const b = analysis.difficultyBreakdown;
  const clause = b ? raisingClause(b) : 'مع ذكر تفصيل أدق';
  // 750 adds two clauses (more reasoning steps); 500 adds one.
  const extra =
    targetPoints === 750
      ? `، وبرر إجابتك باختصار`
      : '';
  const rewrittenQuestion = `بدقة أعلى: ${core} ${clause}${extra}؟`;
  const rewrittenAnswer = row.answer.trim();

  const explanation =
    targetPoints === 750
      ? `أُضيف قيد "${clause}" مع طلب التبرير ليرتفع السؤال إلى ${pointsLabel(750)}: يزيد خطوات الاستنتاج ويطلب معرفة أعمق (الذاكرة/الجماهيرية) بدلاً من التعرف المباشر.`
      : `أُضيف قيد "${clause}" ليرتفع السؤال إلى ${pointsLabel(500)}: يجبر المتسابق على استدعاء تفصيل محدد بدل الإجابة العامة، مما يرفع الذاكرة/التخصّص المطلوب دون بلوغ 750.`;

  return {
    kind: 'harder',
    targetPoints,
    rewrittenQuestion,
    rewrittenAnswer,
    explanation,
  };
}

/** Build a "better-balanced 500" rewrite (same tier, clearer wording). */
function balancedRewrite(
  row: ImportedRow,
  analysis: RowAnalysis
): RewriteSuggestion {
  const core = coreOf(row.question);
  const b = analysis.difficultyBreakdown;
  const qualifier =
    b && b.ambiguityScore >= 50
      ? 'تحديداً ودون لبس'
      : 'بدقة';
  // Add a uniqueness qualifier to kill multiple-answers / vagueness.
  const rewrittenQuestion = `${qualifier}: ${core} (إجابة واحدة فريدة)؟`;
  const rewrittenAnswer = row.answer.trim();

  const explanation = `أُعيدت صياغة السؤال كـ ${pointsLabel(500)} أكثر توازناً: أُضيف مُقيِّد "إجابة واحدة فريدة" لتقليل الغموض (كان ${b ? b.ambiguityScore : '?'}/100) ومنع تعدد الإجابات، مع الحفاظ على نفس المستوى المعرفي دون رفع الصعوبة.`;

  return {
    kind: 'better-balance',
    targetPoints: 500,
    rewrittenQuestion,
    rewrittenAnswer,
    explanation,
  };
}

/** Build a "wording-only" rewrite for an already-hard (750) question. */
function wordingOnlyRewrite(
  row: ImportedRow,
  analysis: RowAnalysis
): RewriteSuggestion {
  const core = coreOf(row.question);
  const b = analysis.difficultyBreakdown;
  const tighter =
    b && b.ambiguityScore >= 45
      ? `بدقة ودون أي لبس: ${core}؟`
      : `صياغة محكمة: ${core}؟`;
  const rewrittenAnswer = row.answer.trim();

  const explanation = `بقي السؤال عند ${pointsLabel(750)} مع تحسين اللفظ فقط: حُذفت العبارات الغامضة ورُتّبت الكلمات لتوضيح المطلوب بدقة، دون تغيير المعرفة المطلوبة أو عدد خطوات الاستنتاج.`;

  return {
    kind: 'wording-only',
    targetPoints: 750,
    rewrittenQuestion: tighter,
    rewrittenAnswer,
    explanation,
  };
}

/**
 * Decide which rewrites to generate based on the current point tier, per spec.
 */
function rewritesFor(
  row: ImportedRow,
  analysis: RowAnalysis
): RewriteSuggestion[] {
  const points = difficultyToPoints(analysis.difficultySuggestion.difficulty);
  const out: RewriteSuggestion[] = [];

  if (points === 250) {
    out.push(harderRewrite(row, analysis, 500));
    out.push(harderRewrite(row, analysis, 750));
  } else if (points === 500) {
    out.push(balancedRewrite(row, analysis));
    out.push(harderRewrite(row, analysis, 750));
  } else {
    // 750 — wording only.
    out.push(wordingOnlyRewrite(row, analysis));
  }

  return out;
}

/**
 * Produce full coaching for one question. Consumes the analyzer result; never
 * recomputes difficulty/quality.
 */
export function coachQuestion(
  row: ImportedRow,
  analysis: RowAnalysis
): QuestionCoaching {
  const currentDifficulty = analysis.difficultySuggestion.difficulty;
  const currentPoints = difficultyToPoints(currentDifficulty);

  // Skip rewriting for empty/broken rows but still return a coaching object.
  if (!row.question.trim()) {
    return {
      rowIndex: row.rowIndex,
      currentDifficulty,
      currentPoints,
      improvementSuggestion: 'لا يوجد نص سؤال لتحليله أو تحسينه.',
      rewrites: [],
    };
  }

  return {
    rowIndex: row.rowIndex,
    currentDifficulty,
    currentPoints,
    improvementSuggestion: improvementSuggestion(row, analysis),
    rewrites: rewritesFor(row, analysis),
  };
}

// Internal helpers re-exported for the report module.
export { difficultyLabel };
export type { RewriteKind };
