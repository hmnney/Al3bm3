import type { CategoryId, Question } from '@/lib/types';

/**
 * Local media path helpers. All media is served from the app's own /public
 * tree — never from external URLs — so the game keeps working offline and
 * assets are fully under the project's control.
 *
 *   /public/category-images/<id>.jpg   — one image per category
 *   /public/images/<path>              — question images
 *   /public/audio/<path>               — question audio
 *   /public/video/<path>               — question video
 *
 * Every helper returns a root-relative URL (e.g. "/category-images/conan.jpg")
 * suitable for <img src>, <audio src>, fetch() preloading, etc.
 *
 * Resolution is pure and side-effect free. Existence checks happen at runtime
 * in the components (image onError, audio/video error events) so a missing
 * file never crashes the app — the caller simply falls back to the existing
 * placeholder UI.
 */

/** Resolve the category image URL from a category id. */
export function categoryImageUrl(categoryId: CategoryId): string {
  return `/category-images/${categoryId}.jpg`;
}

/** Resolve a question image URL.
 *  - Absolute URLs (http/https/data:blob:) pass through unchanged.
 *  - Root-relative paths ("/foo.jpg") pass through unchanged.
 *  - Bare filenames ("foo.jpg") resolve to /images/foo.jpg.
 */
export function questionImageUrl(path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return path.startsWith('/') ? path : `/images/${path}`;
}

/** Resolve a question audio URL. Same rules as questionImageUrl. */
export function questionAudioUrl(path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return path.startsWith('/') ? path : `/audio/${path}`;
}

/** Resolve a question video URL. Same rules as questionImageUrl. */
export function questionVideoUrl(path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return path.startsWith('/') ? path : `/video/${path}`;
}

/**
 * Preload an image by creating a detached <img> element. Resolves to true when
 * the image loads successfully, false on error. Never throws. Used to warm the
 * browser cache before a modal/card renders the image so it appears instantly.
 */
export function preloadImage(url: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * Preload a media URL (audio/video) via a HEAD fetch. Resolves true on a 2xx,
 * false otherwise. Never throws — used to confirm an asset exists before the
 * player mounts it.
 */
export function preloadMediaUrl(url: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return fetch(url, { method: 'HEAD' })
    .then((r) => r.ok)
    .catch(() => false);
}

/** Whether a question carries any media at all (drives conditional rendering). */
export function hasMedia(q: Question): boolean {
  return Boolean(q.image || q.audio || q.video);
}
