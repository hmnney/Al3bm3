/**
 * TMDB (The Movie Database) API client.
 *
 * All functions run in the browser. The API key is public (NEXT_PUBLIC_) and
 * safe to expose — TMDB's v3 API uses it for rate-limiting, not authentication.
 */

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const TMDB_CONFIGURED = Boolean(TMDB_API_KEY);

export interface TmdbMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string | null;
  genre_ids: number[];
}

export interface TmdbSearchResult {
  page: number;
  results: TmdbMovie[];
  total_pages: number;
  total_results: number;
}

/**
 * Search movies by title. Returns the first page of results.
 */
export async function searchMovies(query: string, page = 1): Promise<TmdbSearchResult> {
  if (!TMDB_API_KEY) throw new Error('TMDB API key not configured');
  const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
    query
  )}&language=en-US&page=${page}&include_adult=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
  return (await res.json()) as TmdbSearchResult;
}

/**
 * Fetch popular movies. Returns the first page (20 movies).
 */
export async function popularMovies(page = 1): Promise<TmdbSearchResult> {
  if (!TMDB_API_KEY) throw new Error('TMDB API key not configured');
  const url = `${TMDB_BASE}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB popular failed: ${res.status}`);
  return (await res.json()) as TmdbSearchResult;
}

/**
 * Search TV shows by title.
 */
export async function searchTv(query: string, page = 1): Promise<TmdbSearchResult> {
  if (!TMDB_API_KEY) throw new Error('TMDB API key not configured');
  const url = `${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
    query
  )}&language=en-US&page=${page}&include_adult=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB TV search failed: ${res.status}`);
  const data = (await res.json()) as TmdbSearchResult;
  // Normalize: TV results use `name` instead of `title`
  data.results = data.results.map((r) => ({
    ...r,
    title: (r as unknown as { name?: string }).name ?? r.title,
  }));
  return data;
}

/**
 * Build a full poster URL from a TMDB poster_path.
 * @param posterPath - e.g. "/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg"
 * @param size - TMDB image size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original'
 */
export function tmdbPosterUrl(
  posterPath: string | null,
  size: string = 'w500'
): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}

/**
 * Download a TMDB poster and convert it to a compressed JPEG data URI.
 * This runs entirely in the browser (fetch → blob → canvas → data URI).
 *
 * @param posterPath - TMDB poster_path (e.g. "/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg")
 * @param size - Image size to download
 * @param maxDim - Max dimension for compression (default 500px)
 * @returns JPEG data URI string
 */
export async function downloadPosterAsDataUri(
  posterPath: string,
  size: string = 'w500',
  maxDim = 500,
  quality = 0.85
): Promise<string> {
  const url = tmdbPosterUrl(posterPath, size);
  if (!url) throw new Error('No poster path provided');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Poster download failed: ${res.status}`);
  const blob = await res.blob();

  // Convert blob → data URI via FileReader
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read poster blob'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  // Compress via canvas to keep storage small
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode poster image'));
    el.src = dataUri;
  });

  let { naturalWidth: width, naturalHeight: height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}
