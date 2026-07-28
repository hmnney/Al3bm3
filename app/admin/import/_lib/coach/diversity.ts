import type {
  TopicCluster,
  TopicDiversityAnalysis,
  TopicRecommendation,
} from './types';
import type { ImportedRow, RowAnalysis } from '../ai/types';
import { normalize, tokenList } from '../ai/text-utils';

/**
 * Topic diversity analysis — detects repeated topics/entities across the
 * imported file and recommends topics to add for diversity.
 *
 * Consumes analyzer results only (uses rows + their non-duplicate status).
 * Never recomputes any analyzer signal.
 *
 * Approach:
 *  1. Tokenize every non-empty, non-duplicate question into content tokens.
 *  2. Count token frequency across the file.
 *  3. Treat high-frequency content tokens as "dominant topics" and cluster
 *     the rows that contain each.
 *  4. For each dominant topic, recommend sibling topics via a curated
 *     entity→related-topics map, falling back to adjacent frequent tokens.
 */

/** Stopwords excluded when finding dominant topic tokens. */
const STOPWORDS = new Set([
  'من', 'ما', 'ماذا', 'كم', 'أين', 'متى', 'لماذا', 'كيف', 'هل', 'في', 'على',
  'عن', 'مع', 'و', 'أو', 'ثم', 'ال', 'هو', 'هي', 'هذا', 'هذه', 'ذلك', 'تلك',
  'التي', 'الذي', 'اسم', 'عدد', 'سنة', 'عام', 'وفي', 'لا', 'ما', 'إلى', 'حول',
  'بعد', 'قبل', 'عند', 'كل', 'بعض', 'أكثر', 'أول', 'أخير', 'وحيد', 'الثاني',
  'الثالثة', 'الرابع', 'الأولى', 'اللاعب', 'اللاعبين', 'الفريق', 'المنتخب',
  'النادي', 'اللاعب', 'هدف', 'أهداف', 'مباراة', 'مباريات', 'فيلم', 'مسلسل',
  'أنمي', 'لعبة', 'أغنية', 'مغني', 'فنان', 'عاصمة', 'دولة', 'مدينة', 'عالم',
  'مؤلف', 'مخرج', 'بطولة', 'بطل', 'كأس', 'دوري', 'كاس', 'كأسه',
]);

/**
 * Curated entity → sibling-topics map. Makes recommendations feel intelligent
 * for well-known domains. Keys are normalized Arabic forms.
 */
const RELATED: Record<string, string[]> = {
  // Football players
  ميسي: ['كأس العالم', 'دوري أبطال أوروبا', 'لاعبين أساطير', 'منتخبات وطنية'],
  رونالدو: ['كأس العالم', 'دوري أبطال أوروبا', 'لاعبين أساطير', 'منتخبات وطنية'],
  'ريال مدريد': ['دوري أبطال أوروبا', 'لاعبي ريال مدريد التاريخيين', 'الكلاسيكو'],
  برشلونه: ['دوري أبطال أوروبا', 'لاعبي برشلونة التاريخيين', 'الكلاسيكو'],
  // Saudi league
  الهلال: ['لاعبين أجانب في الدوري', 'مدربين الدوري السعودي', 'تاريخ الدوري السعودي'],
  النصر: ['لاعبين أجانب في الدوري', 'مدربين الدوري السعودي', 'تاريخ الدوري السعودي'],
  الاتحاد: ['لاعبين أجانب في الدوري', 'مدربين الدوري السعودي', 'تاريخ الدوري السعودي'],
  // Anime / Conan
  كونان: ['شخصيات أخرى في المحقق كونان', 'كازوها', 'هايبارا', 'منظمة العباءة السوداء'],
  ناروتو: ['شخصيات ناروتو', 'القرى المخفية', 'النينجا الأساطير'],
  ون_بيس: ['طاقم قبعة القش', 'اليونكو', 'عالم ون بيس'],
  // Movies / series
  مارفل: ['أبطال مارفل', 'مرحلة مارفل', 'أفلام مارفل'],
  ابطال: ['أفلام أخرى لنفس المخرج', 'شخصيات مساندة', 'جوائز الأوسكار'],
};

/** Generic fallback recommendations when no curated entry exists. */
const GENERIC_RECS = [
  'مواضيع متنوعة في نفس المجال',
  'حقائق أقل شيوعاً',
  'شخصيات/أحداث لم تُذكر بعد',
];

/** Content tokens for a question (stopwords removed, length > 1). */
function contentTokens(question: string): string[] {
  return tokenList(question).filter((t) => !STOPWORDS.has(t) && t.length > 2);
}

/** Build a frequency map of content tokens across all eligible rows. */
function tokenFrequency(
  rows: ImportedRow[],
  analyses: RowAnalysis[]
): Map<string, number> {
  const freq = new Map<string, number>();
  rows.forEach((row, i) => {
    const a = analyses[i];
    if (!a) return;
    if (a.flags.includes('empty-row') || a.flags.includes('duplicate')) return;
    if (!row.question.trim()) return;
    const seen = new Set<string>();
    contentTokens(row.question).forEach((t) => seen.add(t));
    seen.forEach((t) => {
      freq.set(t, (freq.get(t) || 0) + 1);
    });
  });
  return freq;
}

/** Pick the dominant topics: tokens whose frequency meets the threshold. */
function dominantTopics(
  freq: Map<string, number>,
  total: number
): Array<{ token: string; count: number }> {
  // Threshold: at least 3 occurrences, and at least ~12% of rows (so a single
  // dominant entity in a small file still triggers).
  const threshold = Math.max(3, Math.round(total * 0.12));
  const out: Array<{ token: string; count: number }> = [];
  freq.forEach((count, token) => {
    if (count >= threshold) out.push({ token, count });
  });
  out.sort((a, b) => b.count - a.count);
  // Cap to the top 6 clusters to keep the report readable.
  return out.slice(0, 6);
}

/** Build a cluster for one dominant token: which rows mention it + samples. */
function buildCluster(
  token: string,
  count: number,
  rows: ImportedRow[],
  analyses: RowAnalysis[]
): TopicCluster {
  const rowIndices: number[] = [];
  const samples: string[] = [];
  rows.forEach((row, i) => {
    const a = analyses[i];
    if (!a) return;
    if (a.flags.includes('empty-row') || a.flags.includes('duplicate')) return;
    if (!row.question.trim()) return;
    const tokens = new Set(contentTokens(row.question));
    if (!tokens.has(token)) return;
    rowIndices.push(row.rowIndex);
    if (samples.length < 3) samples.push(row.question.trim());
  });
  return { topic: token, count, rowIndices, sampleQuestions: samples };
}

/** Look up curated related topics, else fall back to generic + adjacent. */
function recommendationsFor(
  topic: string,
  freq: Map<string, number>
): TopicRecommendation[] {
  const curated = RELATED[topic] || RELATED[normalize(topic)];
  if (curated && curated.length > 0) {
    return curated.slice(0, 4).map((addTopic) => ({
      addTopic,
      reason: `الملف يركز على "${topic}"؛ أضف "${addTopic}" لتنويع المواضيع وتجنب التكرار.`,
    }));
  }
  // Fallback: pick the next most frequent tokens that aren't the topic itself.
  const adjacent: string[] = [];
  const sorted: Array<{ token: string; count: number }> = [];
  freq.forEach((count, token) => {
    if (token !== topic) sorted.push({ token, count });
  });
  sorted.sort((a, b) => b.count - a.count);
  sorted.slice(0, 2).forEach((s) => adjacent.push(s.token));
  const topics = adjacent.length > 0 ? adjacent : GENERIC_RECS;
  return topics.slice(0, 3).map((addTopic) => ({
    addTopic,
    reason: `الملف يكرّر موضوع "${topic}" (${freq.get(topic)} مرات)؛ أضف "${addTopic}" لتنويع المحتوى.`,
  }));
}

/** Run the topic diversity analysis over the analyzer results. */
export function analyzeDiversity(
  rows: ImportedRow[],
  analyses: RowAnalysis[]
): TopicDiversityAnalysis {
  const eligible = analyses.filter(
    (a) => !a.flags.includes('empty-row') && !a.flags.includes('duplicate')
  ).length;

  const freq = tokenFrequency(rows, analyses);
  const dominants = dominantTopics(freq, eligible);

  const clusters: TopicCluster[] = dominants.map((d) =>
    buildCluster(d.token, d.count, rows, analyses)
  );

  // Recommendations: one batch per dominant topic (capped overall to keep it
  // readable), deduped by addTopic.
  const recommendations: TopicRecommendation[] = [];
  const seen = new Set<string>();
  clusters.forEach((c) => {
    recommendationsFor(c.topic, freq).forEach((rec) => {
      if (seen.has(rec.addTopic)) return;
      seen.add(rec.addTopic);
      recommendations.push(rec);
    });
  });

  const notes =
    clusters.length === 0
      ? 'لا توجد مواضيع مكررة بوضوح؛ تنويع الملف جيد.'
      : `رُصد ${clusters.length} موضوع مكرر بارز. يُنصح بتنويع الملف بإضافة المواضيع الموصى بها لتقليل التركيز على نفس الكيان.`;

  return { clusters, recommendations, notes };
}
