/**
 * Shared JSON parsing + repair utilities for all AI providers.
 *
 * Models occasionally wrap JSON in markdown fences, prepend prose, or
 * truncate output. These helpers tolerate all of that and attempt a
 * best-effort repair before giving up.
 */

/**
 * Attempt to parse JSON from a model response, tolerating:
 *  - markdown code fences (```json ... ```)
 *  - leading/trailing prose
 *  - trailing commas
 *  - smart quotes
 *
 * Returns null if the text cannot be repaired into valid JSON.
 */
export function parseJsonLoose<T>(text: string): T | null {
  if (!text || !text.trim()) return null;

  // 1. Direct parse.
  let candidate = text.trim();
  const direct = tryParse<T>(candidate);
  if (direct !== null) return direct;

  // 2. Strip markdown code fences.
  const fenceMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const fenced = tryParse<T>(fenceMatch[1].trim());
    if (fenced !== null) return fenced;
  }

  // 3. Extract the first { ... } or [ ... ] block.
  const block = extractFirstBlock(candidate);
  if (block) {
    const parsed = tryParse<T>(block);
    if (parsed !== null) return parsed;
  }

  // 4. Repair common issues and retry.
  const repaired = repairJson(candidate);
  const repairedResult = tryParse<T>(repaired);
  if (repairedResult !== null) return repairedResult;

  return null;
}

/** Safe JSON.parse that never throws — returns null on failure. */
function tryParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Extract the first balanced { ... } or [ ... ] block from text. */
function extractFirstBlock(text: string): string | null {
  const objStart = text.indexOf('{');
  const arrStart = text.indexOf('[');
  let start: number;
  let open: string;
  let close: string;

  if (objStart === -1 && arrStart === -1) return null;
  if (objStart === -1) {
    start = arrStart;
    open = '[';
    close = ']';
  } else if (arrStart === -1) {
    start = objStart;
    open = '{';
    close = '}';
  } else {
    if (objStart < arrStart) {
      start = objStart;
      open = '{';
      close = '}';
    } else {
      start = arrStart;
      open = '[';
      close = ']';
    }
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Apply common repairs to malformed JSON strings. */
function repairJson(text: string): string {
  let result = text;

  // Replace smart quotes with straight quotes.
  result = result.replace(/[\u201C\u201D]/g, '"');
  result = result.replace(/[\u2018\u2019]/g, "'");

  // Remove trailing commas before } or ].
  result = result.replace(/,(\s*[}\]])/g, '$1');

  // Remove single-line comments.
  result = result.replace(/\/\/.*$/gm, '');

  return result;
}

/**
 * Fetch with a timeout. Returns a standard Response.
 * Throws an Error with a clear message if the timeout fires.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`انتهت مهلة الطلب (${timeoutMs / 1000} ثانية)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
