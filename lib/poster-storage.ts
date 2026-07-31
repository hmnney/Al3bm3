/**
 * Upload a poster image to Supabase Storage and return a permanent public URL.
 *
 * The `question-media` bucket must exist and be public. If the bucket is
 * missing or the upload fails (RLS, key permissions), the function falls back
 * to returning the data URI itself — which is self-contained and works as an
 * `<img src>` and is persisted in the database `image` column. The caller is
 * told which path was taken via the `method` field.
 */

import { supabase, hasSupabaseConfig, MEDIA_BUCKET } from './supabase-client';

export interface UploadResult {
  ok: boolean;
  url: string;
  method: 'storage' | 'data-uri';
  error?: string;
}

function randomPath(): string {
  return `posters/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
}

/** Convert a data URI to a Blob for upload. */
function dataUriToBlob(dataUri: string): Blob {
  const [meta, b64] = dataUri.split(',');
  const mime = /data:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Upload the edited image to Supabase Storage. Falls back to the data URI
 * (embedded in the database row) when Storage is unavailable.
 */
export async function uploadPosterImage(
  dataUri: string
): Promise<UploadResult> {
  if (!hasSupabaseConfig) {
    return { ok: true, url: dataUri, method: 'data-uri' };
  }

  try {
    const path = randomPath();
    const blob = dataUriToBlob(dataUri);
    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, blob, { contentType: blob.type, upsert: false });

    if (error) {
      // Bucket missing / RLS denied — fall back to data URI so the poster
      // still saves and renders. Surface the error to the caller.
      return {
        ok: true,
        url: dataUri,
        method: 'data-uri',
        error: `Storage upload failed (${error.message}); saved image data directly.`,
      };
    }

    const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    if (pub?.publicUrl) {
      return { ok: true, url: pub.publicUrl, method: 'storage' };
    }
    return { ok: true, url: dataUri, method: 'data-uri' };
  } catch (e) {
    return {
      ok: true,
      url: dataUri,
      method: 'data-uri',
      error: e instanceof Error ? e.message : 'Upload exception',
    };
  }
}
