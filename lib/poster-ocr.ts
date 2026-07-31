/**
 * In-browser OCR for poster redaction.
 *
 * Uses tesseract.js to detect text on a poster image, then draws black
 * rectangles over the detected title regions so the answer is hidden before
 * the image is saved into the question bank.
 *
 * All functions run client-side only (browser canvas + Web Worker via
 * tesseract.js). They never touch the filesystem or the network except for
 * the one-time OCR language-data download tesseract.js performs itself.
 */

import type { Bbox, Word } from 'tesseract.js';

/** A detected text region with its bounding box and recognized text. */
export interface DetectedText {
  text: string;
  bbox: Bbox;
  confidence: number;
}

/** A redaction rectangle in image pixel coordinates. */
export interface RedactRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Load an image element from a data URI or object URL. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/** Read a File as a data URI. */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/**
 * Run OCR on an image and return detected words with bounding boxes.
 * Returns an empty array if no text is found or OCR fails.
 */
export async function detectText(
  imageSrc: string
): Promise<{ words: DetectedText[]; fullText: string }> {
  const { recognize } = await import('tesseract.js');
  const result = await recognize(imageSrc, 'eng', {
    logger: () => {},
  } as never);
  const page = result.data;
  const words: DetectedText[] = (page.words ?? [])
    .filter((w: Word) => w.text.trim().length > 0 && w.confidence > 40)
    .map((w: Word) => ({
      text: w.text.trim(),
      bbox: w.bbox,
      confidence: w.confidence,
    }));
  return { words, fullText: page.text?.trim() ?? '' };
}

/**
 * Decide which detected words are likely the poster title and should be
 * redacted. Heuristic: group words into lines (by vertical overlap), then
 * pick the top region(s) — movie posters almost always place the title in the
 * upper third or bottom third. We redact any text line that is NOT clearly
 * metadata (rating, studio, date, "coming soon", etc.).
 */
export function pickTitleRegions(
  words: DetectedText[],
  imageWidth: number,
  imageHeight: number
): RedactRect[] {
  if (words.length === 0) return [];

  // Sort by vertical position
  const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0);

  // Group words into lines by vertical overlap
  const lines: DetectedText[][] = [];
  for (const word of sorted) {
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      const lastWord = lastLine[lastLine.length - 1];
      const overlap = Math.min(word.bbox.y1, lastWord.bbox.y1) - Math.max(word.bbox.y0, lastWord.bbox.y0);
      if (overlap > (word.bbox.y1 - word.bbox.y0) * 0.4) {
        lastLine.push(word);
        continue;
      }
    }
    lines.push([word]);
  }

  // Metadata keywords to skip (ratings, dates, studios, etc.)
  const skip = /^(19|20)\d{2}|rated|r|pg|pg-?13|nc-?17|g|tv-?14|tv-?ma|tv-?pg|coming|soon|in theaters|imax|3d|dolby|atmos|now showing|present|presents|a film|production|studios?|pictures?|entertainment|only|theaters?|cinemas?$/i;

  const rects: RedactRect[] = [];
  for (const line of lines) {
    const lineText = line.map((w) => w.text).join(' ').trim();
    if (!lineText) continue;
    if (skip.test(lineText)) continue;

    const x0 = Math.min(...line.map((w) => w.bbox.x0));
    const y0 = Math.min(...line.map((w) => w.bbox.y0));
    const x1 = Math.max(...line.map((w) => w.bbox.x1));
    const y1 = Math.max(...line.map((w) => w.bbox.y1));

    // Skip tiny noise
    if (x1 - x0 < imageWidth * 0.08) continue;
    if (y1 - y0 < 6) continue;

    // Add padding so the rectangle fully covers the text
    const padX = Math.round((x1 - x0) * 0.04);
    const padY = Math.round((y1 - y0) * 0.25);
    rects.push({
      x: Math.max(0, x0 - padX),
      y: Math.max(0, y0 - padY),
      width: Math.min(imageWidth, x1 - x0 + padX * 2),
      height: Math.min(imageHeight, y1 - y0 + padY * 2),
    });
  }

  return rects;
}

/**
 * Draw black rectangles over the given regions on an image and return the
 * edited image as a JPEG data URI (compressed).
 */
export async function applyRedactions(
  imageSrc: string,
  rects: RedactRect[],
  quality = 0.85
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#000';
  for (const r of rects) {
    ctx.fillRect(r.x, r.y, r.width, r.height);
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Suggest the correct answer from detected text. Returns the longest line of
 * detected text that is not metadata — this is usually the title.
 */
export function suggestAnswer(words: DetectedText[], imageWidth: number): string {
  if (words.length === 0) return '';

  // Group into lines
  const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const lines: DetectedText[][] = [];
  for (const word of sorted) {
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      const lastWord = lastLine[lastLine.length - 1];
      const overlap = Math.min(word.bbox.y1, lastWord.bbox.y1) - Math.max(word.bbox.y0, lastWord.bbox.y0);
      if (overlap > (word.bbox.y1 - word.bbox.y0) * 0.4) {
        lastLine.push(word);
        continue;
      }
    }
    lines.push([word]);
  }

  const skip = /^(19|20)\d{2}|rated|r|pg|pg-?13|nc-?17|g|tv-?14|tv-?ma|tv-?pg|coming|soon|in theaters|imax|3d|dolby|atmos|now showing|present|presents|a film|production|studios?|pictures?|entertainment|only|theaters?|cinemas?$/i;

  const candidates: { text: string; width: number }[] = [];
  for (const line of lines) {
    const text = line.map((w) => w.text).join(' ').trim();
    if (!text || skip.test(text)) continue;
    const x0 = Math.min(...line.map((w) => w.bbox.x0));
    const x1 = Math.max(...line.map((w) => w.bbox.x1));
    candidates.push({ text, width: x1 - x0 });
  }

  if (candidates.length === 0) return '';
  // Prefer the widest line (usually the title)
  candidates.sort((a, b) => b.width - a.width);
  return candidates[0].text;
}
