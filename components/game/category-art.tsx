'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Category } from '@/lib/types';
import { categoryImageUrl } from '@/lib/media';

interface CategoryArtProps {
  category: Category;
  className?: string;
  /** When true, the glyph is larger — used on big board cards. */
  large?: boolean;
}

/**
 * Category artwork. Tries to load a real local image from
 * /public/category-images/<id>.jpg; if that file is missing (or hasn't been
 * added yet), it falls back seamlessly to the original gradient + glyph
 * placeholder. The fallback is visually identical to the pre-media design, so
 * no page changes appearance until an asset actually exists.
 *
 * Error-safe: a missing/broken image never crashes — the placeholder simply
 * stays in place.
 */
export function CategoryArt({ category, className, large }: CategoryArtProps) {
  const url = categoryImageUrl(category.id);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    'loading'
  );

  useEffect(() => {
    setStatus('loading');
  }, [url]);

  const showImage = status === 'loaded';
  const showSkeleton = status === 'loading';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br',
        category.gradient,
        className
      )}
      aria-hidden
    >
      {/* Real image, layered above the gradient so it covers it once loaded */}
      {status !== 'error' && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            showImage ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}

      {/* Skeleton shimmer while the image loads */}
      {showSkeleton && (
        <div className="absolute inset-0 animate-pulse bg-black/10" />
      )}

      {/* Original placeholder art — stays visible until the image is ready */}
      {!showImage && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer" />
          <div className="absolute inset-0 bg-gradient-radial from-white/20 to-transparent opacity-60" />
          <span
            className={cn(
              'relative drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
              large ? 'text-6xl sm:text-7xl' : 'text-5xl'
            )}
          >
            {category.glyph}
          </span>
        </>
      )}
    </div>
  );
}
