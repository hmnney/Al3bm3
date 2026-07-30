import { supabase } from './supabase-client';

/**
 * Durable persistence backed by Supabase Storage.
 *
 * The admin panel stores three JSON blobs (admin data, settings, interactive
 * categories). localStorage is used as a fast cache so the UI renders
 * instantly; Supabase Storage is the source of truth so data survives
 * project restarts (which wipe localStorage in the preview environment).
 *
 * The `app-state` bucket MUST already exist in the Supabase project. We never
 * create buckets from the client — doing so fails with a permission error.
 * If the bucket is missing, uploads return a clear error message.
 */

const BUCKET = 'app-state';

export interface StorageResult {
  ok: boolean;
  /** Human-readable error message (never generic). */
  error?: string;
  /** HTTP status if available. */
  status?: number;
}

/**
 * Raw fetch probe — bypasses the Supabase JS client to capture the EXACT
 * HTTP status code, response headers, and response body returned by the
 * Supabase Storage API. The Supabase JS client wraps network errors into
 * a generic "Load failed" message, hiding the real status code.
 */
async function rawStorageProbe(
  supabaseUrl: string,
  supabaseKey: string,
  bucket: string,
  path: string,
  body: string,
): Promise<void> {
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
  console.log('[state-persistence] RAW PROBE — URL:', uploadUrl);

  try {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body,
    });

    const responseText = await res.text();
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { responseHeaders[k] = v; });

    console.log('[state-persistence] RAW PROBE RESULT:', {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: responseText.slice(0, 2000),
    });
  } catch (e) {
    console.log('[state-persistence] RAW PROBE FETCH THREW:', e instanceof Error ? e.message : String(e));
  }
}

/** Write a JSON blob to Supabase Storage. Returns detailed result. */
export async function putState<T>(key: string, value: T): Promise<StorageResult> {
  const path = `${key}.json`;
  try {
    console.log('[state-persistence] putState START — bucket:', BUCKET, 'path:', path);

    const body = JSON.stringify(value);
    console.log('[state-persistence] upload START — size:', body.length, 'bytes');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    await rawStorageProbe(supabaseUrl, supabaseKey, BUCKET, path, body);

    const { error, data } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, {
        cacheControl: '0',
        upsert: true,
        contentType: 'application/json',
      });

    if (error) {
      console.error('[state-persistence] upload FAILED:', {
        path,
        message: error.message,
        name: error.name,
        statusCode: (error as { statusCode?: string }).statusCode,
      });
      return {
        ok: false,
        status: (error as { statusCode?: string }).statusCode ? Number((error as { statusCode?: string }).statusCode) : undefined,
        error: `Upload failed for "${path}" in bucket "${BUCKET}": ${error.message}`,
      };
    }

    console.log('[state-persistence] upload SUCCESS — path:', path, 'data:', data);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : '';
    console.error('[state-persistence] putState EXCEPTION:', {
      path,
      message: msg,
      stack,
    });
    return {
      ok: false,
      error: `Exception uploading "${path}" to bucket "${BUCKET}": ${msg}`,
    };
  }
}

/**
 * Raw fetch probe for downloads — captures the EXACT HTTP status code
 * and response body from the Supabase Storage download endpoint.
 */
async function rawDownloadProbe(
  supabaseUrl: string,
  supabaseKey: string,
  bucket: string,
  path: string,
): Promise<void> {
  const downloadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
  console.log('[state-persistence] RAW DOWNLOAD PROBE — URL:', downloadUrl);

  try {
    const res = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
    });

    const responseText = await res.text();
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { responseHeaders[k] = v; });

    console.log('[state-persistence] RAW DOWNLOAD PROBE RESULT:', {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: responseText.slice(0, 2000),
    });
  } catch (e) {
    console.log('[state-persistence] RAW DOWNLOAD PROBE FETCH THREW:', e instanceof Error ? e.message : String(e));
  }
}

/** Read a JSON blob from Supabase Storage. Returns null if missing/error. */
export async function getState<T>(key: string): Promise<T | null> {
  const path = `${key}.json`;
  try {
    console.log('[state-persistence] getState START — bucket:', BUCKET, 'path:', path);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    await rawDownloadProbe(supabaseUrl, supabaseKey, BUCKET, path);

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(path);

    if (error) {
      console.error('[state-persistence] download error:', {
        path,
        message: error.message,
        name: error.name,
        statusCode: (error as { statusCode?: string }).statusCode,
      });
      return null;
    }
    if (!data) {
      console.log('[state-persistence] download — no data for path:', path);
      return null;
    }

    const text = await data.text();
    console.log('[state-persistence] download SUCCESS — path:', path, 'size:', text.length);
    return JSON.parse(text) as T;
  } catch (e) {
    console.error('[state-persistence] getState EXCEPTION:', {
      path,
      error: e,
    });
    return null;
  }
}

/** localStorage helpers — fast synchronous cache layer. */
export function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}
