import type {
  CategoryResolution,
  ImportProgress,
  ImportReport,
  RowEnrichment,
  RowOverride,
  ValidatedRow,
} from './types';
import { normalizeDifficulty } from './types';
import { matchCategory, type MatchableCategory } from './category-matcher';

/**
 * Importer module — executes the actual import, row by row, with progress.
 *
 * FAULT TOLERANCE: every row is wrapped in its own try/catch. A single bad
 * row never aborts the entire import. The import ALWAYS finishes and returns
 * a report.
 *
 * CATEGORY RESOLUTION: unknown categories are auto-created by default. The
 * admin can override this via the resolution screen, but if no resolution
 * is set, the category is created (not skipped).
 */

export interface ImporterCallbacks {
  /** Create a new category, return its id. */
  createCategory: (name: string) => string;
  /** Create a new question. */
  createQuestion: (g: {
    categoryId: string;
    difficulty: 'easy' | 'medium' | 'hard';
    points: 250 | 500 | 750;
    question: string;
    answer: string;
    image?: string;
    audio?: string;
    video?: string;
    questionType?: 'normal' | 'multiple_choice';
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
  }) => void;
  /** Update an existing question (for duplicate updates). */
  updateQuestionByText?: (
    questionText: string,
    patch: Partial<{
      categoryId: string;
      difficulty: 'easy' | 'medium' | 'hard';
      points: 250 | 500 | 750;
      answer: string;
      image?: string;
      audio?: string;
      video?: string;
      questionType?: 'normal' | 'multiple_choice';
      optionA?: string;
      optionB?: string;
      optionC?: string;
      optionD?: string;
    }>
  ) => boolean;
  /** Called on each imported row with current progress. */
  onProgress?: (p: ImportProgress) => void;
}

/** Run the import over validated rows. Fully fault-tolerant. */
export async function runImport(
  validated: ValidatedRow[],
  resolutions: Record<string, CategoryResolution>,
  existingCategories: MatchableCategory[],
  callbacks: ImporterCallbacks,
  enrichments?: RowEnrichment[],
  overrides?: Record<number, RowOverride>
): Promise<ImportReport> {
  const importable = validated.filter((v) => v.status !== 'error');
  const total = importable.length;
  const startTime = Date.now();

  let imported = 0;
  let skipped = 0;
  let duplicates = 0;
  let warnings = 0;
  let errors = 0;
  let newCategories = 0;
  let matchedCategories = 0;
  let importedImages = 0;
  let importedVideos = 0;
  let importedAudio = 0;
  let skippedMedia = 0;

  const createdCategoryNames: string[] = [];
  const matchedCategoryNames: string[] = [];
  const failedRows: number[] = [];
  const failedRowErrors: Record<number, string> = {};
  const resolvedCache = new Map<string, string>();

  // Build a lookup: rowIndex → enrichment.
  const enrichmentMap = new Map<number, RowEnrichment>();
  if (enrichments) {
    enrichments.forEach((e) => enrichmentMap.set(e.rowIndex, e));
  }

  for (let i = 0; i < importable.length; i++) {
    const rowNumber = i + 1;
    const { row, status, issues } = importable[i];

    try {
      if (issues.includes('سؤال مكرر')) duplicates++;
      if (status === 'warning') warnings++;

      console.log(`[Row ${rowNumber}] start — question: "${row.question.slice(0, 50)}", category: "${row.category}"`);

      // --- Determine effective category/difficulty/points ---
      const enrichment = enrichmentMap.get(row.rowIndex);
      const override = overrides?.[row.rowIndex];

      const rawCategory = (override?.category ?? enrichment?.aiCategory ?? row.category).trim();
      const effectiveDifficulty = override?.difficulty
        ?? enrichment?.aiDifficulty
        ?? normalizeDifficulty(row.difficulty);
      const effectivePoints = resolvePoints(
        override?.points,
        enrichment?.aiPoints,
        row.points,
        effectiveDifficulty
      );

      // --- Resolve category ---
      let categoryId: string | null = null;

      if (resolvedCache.has(rawCategory)) {
        categoryId = resolvedCache.get(rawCategory)!;
      } else {
        const match = matchCategory(rawCategory, existingCategories);
        if (match.categoryId) {
          categoryId = match.categoryId;
          matchedCategories++;
          matchedCategoryNames.push(rawCategory);
          resolvedCache.set(rawCategory, categoryId);
        } else if (match.ambiguous) {
          // Ambiguous: use resolution or first candidate
          const resolution = resolutions[rawCategory];
          if (resolution?.action === 'map' && resolution.mapToCategoryId) {
            categoryId = resolution.mapToCategoryId;
          } else if (resolution?.action === 'skip') {
            console.log(`[Row ${rowNumber}] skipped (resolution: skip)`);
            skipped++;
            continue;
          } else {
            categoryId = match.candidates[0];
          }
          matchedCategories++;
          matchedCategoryNames.push(rawCategory);
          resolvedCache.set(rawCategory, categoryId);
        } else {
          // No match at all — check resolution, default to create
          const resolution = resolutions[rawCategory];
          if (resolution?.action === 'skip') {
            console.log(`[Row ${rowNumber}] skipped (resolution: skip)`);
            skipped++;
            continue;
          } else if (resolution?.action === 'map' && resolution.mapToCategoryId) {
            categoryId = resolution.mapToCategoryId;
            matchedCategories++;
            matchedCategoryNames.push(rawCategory);
            resolvedCache.set(rawCategory, categoryId);
          } else {
            // Default: create the category (not skip!)
            console.log(`[Row ${rowNumber}] creating new category: "${rawCategory}"`);
            const newId = callbacks.createCategory(rawCategory);
            newCategories++;
            createdCategoryNames.push(rawCategory);
            resolvedCache.set(rawCategory, newId);
            categoryId = newId;
          }
        }
      }

      if (!categoryId) {
        const msg = `[importer.ts runImport row ${rowNumber}] No categoryId resolved for category "${rawCategory}"`;
        console.error(msg);
        errors++;
        failedRows.push(rowNumber);
        failedRowErrors[rowNumber] = msg;
        continue;
      }

      // --- Media validation (non-fatal) ---
      const cleanImage = row.image.trim();
      const cleanAudio = row.audio.trim();
      const cleanVideo = row.video.trim();

      let image: string | undefined;
      let audio: string | undefined;
      let video: string | undefined;

      if (cleanImage) {
        if (isValidMediaExtension(cleanImage, 'image')) {
          image = cleanImage;
          importedImages++;
        } else {
          console.warn(`[Row ${rowNumber}] skipped invalid image: ${cleanImage}`);
          skippedMedia++;
        }
      }
      if (cleanAudio) {
        if (isValidMediaExtension(cleanAudio, 'audio')) {
          audio = cleanAudio;
          importedAudio++;
        } else {
          console.warn(`[Row ${rowNumber}] skipped invalid audio: ${cleanAudio}`);
          skippedMedia++;
        }
      }
      if (cleanVideo) {
        if (isValidMediaExtension(cleanVideo, 'video')) {
          video = cleanVideo;
          importedVideos++;
        } else {
          console.warn(`[Row ${rowNumber}] skipped invalid video: ${cleanVideo}`);
          skippedMedia++;
        }
      }

      // --- media_url fallback: route to image/audio/video by extension ---
      const cleanMediaUrl = row.mediaUrl?.trim() ?? '';
      if (cleanMediaUrl && !image && !audio && !video) {
        if (isValidMediaExtension(cleanMediaUrl, 'image')) {
          image = cleanMediaUrl;
          importedImages++;
        } else if (isValidMediaExtension(cleanMediaUrl, 'audio')) {
          audio = cleanMediaUrl;
          importedAudio++;
        } else if (isValidMediaExtension(cleanMediaUrl, 'video')) {
          video = cleanMediaUrl;
          importedVideos++;
        } else {
          console.warn(`[Row ${rowNumber}] skipped invalid media_url: ${cleanMediaUrl}`);
          skippedMedia++;
        }
      }

      // --- Detect question type ---
      const optionsFilledCount = [row.optionA, row.optionB, row.optionC, row.optionD]
        .filter((o) => o.trim()).length;
      const hasOptions = optionsFilledCount >= 2;
      const questionType: 'normal' | 'multiple_choice' = hasOptions
        ? 'multiple_choice'
        : 'normal';
      const optionA = row.optionA.trim() ? row.optionA.trim() : undefined;
      const optionB = row.optionB.trim() ? row.optionB.trim() : undefined;
      const optionC = row.optionC.trim() ? row.optionC.trim() : undefined;
      const optionD = row.optionD.trim() ? row.optionD.trim() : undefined;

      // --- Duplicate check: update existing question instead of creating a copy ---
      const isDuplicate = issues.includes('سؤال مكرر');
      if (isDuplicate && callbacks.updateQuestionByText) {
        const updated = callbacks.updateQuestionByText(row.question.trim(), {
          categoryId,
          difficulty: effectiveDifficulty,
          points: effectivePoints,
          answer: row.answer.trim(),
          image,
          audio,
          video,
          questionType,
          optionA,
          optionB,
          optionC,
          optionD,
        });
        if (updated) {
          imported++;
        } else {
          callbacks.createQuestion({
            categoryId,
            difficulty: effectiveDifficulty,
            points: effectivePoints,
            question: row.question.trim(),
            answer: row.answer.trim(),
            image,
            audio,
            video,
            questionType,
            optionA,
            optionB,
            optionC,
            optionD,
          });
          imported++;
        }
      } else {
        callbacks.createQuestion({
          categoryId,
          difficulty: effectiveDifficulty,
          points: effectivePoints,
          question: row.question.trim(),
          answer: row.answer.trim(),
          image,
          audio,
          video,
          questionType,
          optionA,
          optionB,
          optionC,
          optionD,
        });
        imported++;
      }
      console.log(`[Row ${rowNumber}] success — imported ${imported}/${total}`);

      const elapsed = (Date.now() - startTime) / 1000;
      const rate = imported / Math.max(elapsed, 0.001);
      const remainingCount = total - imported;
      const estimatedSecondsLeft = remainingCount / Math.max(rate, 0.001);

      callbacks.onProgress?.({
        imported,
        remaining: remainingCount,
        total,
        pct: total > 0 ? (imported / total) * 100 : 100,
        estimatedSecondsLeft: Math.ceil(estimatedSecondsLeft),
      });

      // Yield periodically to keep UI responsive.
      if (i % 5 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) {
      errors++;
      const errObj = err instanceof Error ? err : new Error(String(err));
      const errMsg = `[importer.ts runImport row ${rowNumber}] ${errObj.message}`;
      failedRows.push(rowNumber);
      failedRowErrors[rowNumber] = errMsg;
      console.error(`[Row ${rowNumber}] FAILED:\n${errMsg}`);
      if (errObj.stack) console.error(errObj.stack);
    }
  }

  // Count validation errors (rows that were filtered out before import loop).
  const validationErrors = validated.filter((v) => v.status === 'error').length;
  errors += validationErrors;

  console.log(`[importer] DONE — imported: ${imported}, skipped: ${skipped}, failed: ${failedRows.length}, total: ${total}`);

  return {
    imported,
    skipped,
    duplicates,
    warnings,
    errors,
    failedRows,
    failedRowErrors,
    newCategories,
    matchedCategories,
    createdCategoryNames,
    matchedCategoryNames,
    importedImages,
    importedVideos,
    importedAudio,
    skippedMedia,
  };
}

/**
 * Resolve points with strict validation. Only 250, 500, 750 are valid.
 * Falls back to difficulty-based defaults when raw points are absent or invalid.
 */
function resolvePoints(
  override: 250 | 500 | 750 | undefined,
  aiPoints: 250 | 500 | 750 | undefined,
  rawPoints: string,
  difficulty: 'easy' | 'medium' | 'hard'
): 250 | 500 | 750 {
  if (override) return override;
  if (aiPoints) return aiPoints;
  const parsed = parseStrictPoints(rawPoints);
  if (parsed) return parsed;
  return difficultyToPoints(difficulty);
}

/** Only accept exactly 250, 500, or 750. Returns undefined otherwise. */
function parseStrictPoints(raw: string): 250 | 500 | 750 | undefined {
  const p = Number(raw.trim());
  if (Number.isNaN(p)) return undefined;
  if (p === 250) return 250;
  if (p === 500) return 500;
  if (p === 750) return 750;
  return undefined;
}

/** Valid file extensions per media type. */
const VALID_EXTENSIONS: Record<'image' | 'video' | 'audio', string[]> = {
  image: ['jpg', 'jpeg', 'png', 'webp'],
  video: ['mp4', 'webm', 'ogg', 'mov', 'm4v'],
  audio: ['mp3', 'wav', 'ogg', 'm4a'],
};

/** Check if a media URL has a valid extension for its type. */
function isValidMediaExtension(url: string, type: 'image' | 'video' | 'audio'): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'data:') {
      const mime = url.slice(0, url.indexOf(','));
      return VALID_EXTENSIONS[type].some((ext) => mime.includes(`/${ext}`));
    }
    const pathname = u.pathname.toLowerCase();
    if (VALID_EXTENSIONS[type].some((ext) => pathname.endsWith('.' + ext))) {
      return true;
    }
    // For video and audio, accept any http(s) URL even without a recognized
    // extension — many CDN/streaming URLs have no file extension.
    if (type === 'video' || type === 'audio') {
      return u.protocol === 'http:' || u.protocol === 'https:';
    }
    return false;
  } catch {
    return false;
  }
}

function difficultyToPoints(d: 'easy' | 'medium' | 'hard'): 250 | 500 | 750 {
  return d === 'easy' ? 250 : d === 'medium' ? 500 : 750;
}
