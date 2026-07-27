'use client';

import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaImageProps {
  /** Root-relative URL, e.g. "/images/foo.jpg". */
  src: string;
  alt: string;
  className?: string;
  /** Optional element rendered in place of a broken/missing image. */
  fallback?: React.ReactNode;
  /** Whether to render a shimmer skeleton while loading. */
  skeleton?: boolean;
}

/**
 * Robust local-image renderer for question media.
 *
 * - Lazy-loads via native loading="lazy" + decoding="async".
 * - Shows a shimmer skeleton until the image decodes.
 * - On error (missing file, corrupt, etc.) it never crashes — it renders the
 *   provided fallback or a tasteful "no image" placeholder.
 *
 * This is the single image component used inside the question modal; swapping
 * it later upgrades image rendering everywhere.
 */
export function MediaImage({
  src,
  alt,
  className,
  fallback,
  skeleton = true,
}: MediaImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    'loading'
  );

  // Reset whenever the source changes (new question opened).
  useEffect(() => {
    setStatus('loading');
  }, [src]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {status !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300',
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}

      {status === 'loading' && skeleton && (
        <div className="absolute inset-0 animate-pulse bg-muted/40" />
      )}

      {status === 'error' && (
        <div
          className="flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground"
          aria-label="الصورة غير متوفرة"
        >
          {fallback ?? (
            <div className="flex flex-col items-center gap-2">
              <ImageOff className="h-8 w-8" />
              <span className="text-xs font-semibold">الصورة غير متوفرة</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
