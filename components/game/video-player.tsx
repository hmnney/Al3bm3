'use client';

import { useEffect, useState } from 'react';
import { VideoOff, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  /** Root-relative URL, e.g. "/video/foo.mp4". */
  src: string;
  className?: string;
}

/**
 * Responsive local video player for question media.
 *
 * - 16:9 responsive container (aspect-video) so it scales on every screen.
 * - Lazy: the <video> only mounts after the user presses the poster play
 *   button, so we never fetch video bytes until needed.
 * - Native controls once playing; skeleton while the first frame buffers.
 * - On error (missing file, unsupported codec) it shows a quiet fallback and
 *   never throws — the rest of the modal stays fully usable.
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
          'flex aspect-video w-full items-center justify-center rounded-2xl border-2 border-border/60 bg-muted/30 text-muted-foreground',
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
        preload="metadata"
        onLoadedData={() => setStatus('ready')}
        onError={() => setStatus('error')}
        className="h-full w-full"
      />
    </div>
  );
}
