'use client';

import { useEffect, useState } from 'react';
import { VideoOff, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  /** Video URL — absolute (https://) or root-relative (/video/foo.mp4). */
  src: string;
  className?: string;
}

/**
 * Responsive video player for question media.
 *
 * - 16:9 responsive container.
 * - Auto-plays when the user presses the poster play button.
 * - Uses onLoadedMetadata (fires with preload="metadata") instead of
 *   onLoadedData, so the spinner clears as soon as metadata arrives.
 * - Logs real errors to console instead of silently showing "unavailable".
 */
export function VideoPlayer({ src, className }: VideoPlayerProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle'
  );

  useEffect(() => {
    setStatus('idle');
  }, [src]);

  if (status === 'error') {
    return (
      <div
        className={cn(
          'flex aspect-video w-full items-center justify-center rounded-2xl border-2 border-destructive/40 bg-destructive/5 text-destructive',
          className
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <VideoOff className="h-10 w-10" />
          <span className="text-sm font-semibold">الفيديو غير متوفر</span>
        </div>
      </div>
    );
  }

  // Poster state: show a play button until the user starts the video.
  if (status === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setStatus('loading')}
        aria-label="تشغيل الفيديو"
        className={cn(
          'group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-border/60 bg-gradient-to-br from-background/60 to-muted/40 backdrop-blur transition-all hover:border-primary/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
      >
        <div className="absolute inset-0 animate-pulse bg-muted/20" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-white shadow-lg transition-transform group-hover:scale-110">
          <Play className="h-7 w-7 translate-x-0.5" />
        </div>
      </button>
    );
  }

  return (
    <div
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-border/60 bg-black',
        className
      )}
    >
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        </div>
      )}
      <video
        src={src}
        controls
        autoPlay
        playsInline
        preload="auto"
        onLoadedMetadata={() => setStatus('ready')}
        onCanPlay={() => setStatus('ready')}
        onError={(e) => {
          console.error('[VideoPlayer] error loading:', src, e);
          setStatus('error');
        }}
        className="h-full w-full"
      />
    </div>
  );
}
