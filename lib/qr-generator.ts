/**
 * QR Code generation + Supabase Storage upload for charades questions.
 *
 * The QR encodes ONLY the word itself (e.g. "Harry Potter") — nothing else.
 * The generated PNG is uploaded to the question-media bucket and the public
 * URL is stored in the database `qr_url` column.
 */

import QRCode from 'qrcode';
import { supabase, hasSupabaseConfig, MEDIA_BUCKET } from './supabase-client';

export interface QrResult {
  ok: boolean;
  url: string;
  method: 'storage' | 'data-uri';
  error?: string;
}

function randomPath(): string {
  return `qr/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.png`;
}

/** Generate a QR code as a PNG data URI encoding the given text. */
export async function generateQrDataUri(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

/** Convert a data URI to a Blob for upload. */
function dataUriToBlob(dataUri: string): Blob {
  const [meta, b64] = dataUri.split(',');
  const mime = /data:(.*?);/.exec(meta)?.[1] ?? 'image/png';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Generate a QR code for the given word and upload it to Supabase Storage.
 * Falls back to a data URI (embedded in the database row) when Storage is
 * unavailable.
 */
export async function generateAndUploadQr(word: string): Promise<QrResult> {
  const dataUri = await generateQrDataUri(word);

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
      return {
        ok: true,
        url: dataUri,
        method: 'data-uri',
        error: `Storage upload failed (${error.message}); saved QR data directly.`,
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
      error: e instanceof Error ? e.message : 'QR upload exception',
    };
  }
}
