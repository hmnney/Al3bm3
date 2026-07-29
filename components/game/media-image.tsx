'use client';

import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaImageProps {
  /** Image URL — absolute (https://) or root-relative (/images/foo.jpg). */
  src: string;
  alt: string;
  className?: string;
  /** Optional element rendered in place of a broken/missing image. */
  fallback?: React.ReactNode;
  /** Whether to render a shimmer skeleton while loading. */
  skeleton?: boolean;
}

/**
 * Robust image renderer for question media.
 *
 * - eager loading (the image is in a modal that just opened — lazy would
 *   delay it unnecessarily).
 * - Shows a shimmer skeleton until the image decodes.
 * - On error logs the real reason to console, then renders the fallback.
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
  const [enlarged, setEnlarged] = useState(false);

  // Reset whenever the source changes (new question opened).
  useEffect(() => {
    setStatus('loading');
  }, [src]);

  return (
    <>
      <div className={cn('relative overflow-hidden', className)}>
        {status !== 'error' && (
          <img
            src={src}
            alt={alt}
            loading="eager"
            decoding="async"
            onLoad={() => setStatus('loaded')}
            onError={(e) => {
              console.error('[MediaImage] error loading:', src, e);
              setStatus('error');
            }}
            onClick={() => status === 'loaded' && setEnlarged(true)}
            className={cn(
              'h-full w-full object-contain transition-opacity duration-300 cursor-zoom-in',
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

      {enlarged && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-xl p-4 sm:p-8"
          onClick={() => setEnlarged(false)}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
