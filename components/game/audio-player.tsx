'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, AudioLines } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  /** Audio URL — absolute (https://) or root-relative (/audio/foo.mp3). */
  src: string;
  label?: string;
  className?: string;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Audio player for question media.
 *
 * The <audio> element is always mounted (hidden) so the ref is never null
 * when the user presses play. Event listeners are tied to [src], not to
 * status, so they stay attached across loading → ready transitions.
 */
export function AudioPlayer({ src, label = 'صوت', className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle'
  );
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // Reset state + attach listeners whenever src changes.
  useEffect(() => {
    setStatus('idle');
    setPlaying(false);
    setCurrent(0);
    setDuration(0);

    const el = audioRef.current;
    if (!el) return;

    el.src = src;
    el.load();

    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => {
      setDuration(el.duration || 0);
      setStatus('ready');
    };
    const onCanPlay = () => setStatus('ready');
    const onEnded = () => setPlaying(false);
    const onErr = () => {
      console.error('[AudioPlayer] error loading:', src, el.error);
      setStatus('error');
      setPlaying(false);
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onErr);

    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onErr);
    };
  }, [src]);

  const togglePlay = () => {
    if (status === 'error') return;
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      if (status === 'idle') setStatus('loading');
      el.play()
        .then(() => setPlaying(true))
        .catch((e) => {
          console.error('[AudioPlayer] play() failed:', src, e);
          setStatus((prev) => (prev === 'error' ? prev : 'ready'));
          setPlaying(false);
        });
    }
  };

  const reset = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    setCurrent(0);
    if (playing) {
      el.pause();
      setPlaying(false);
    }
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  if (status === 'error') {
    return (
      <div
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 px-5 py-4 text-destructive',
          className
        )}
      >
        <AudioLines className="h-6 w-6" />
        <span className="text-sm font-semibold">الصوت غير متوفر</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-4 rounded-2xl border-2 border-border/60 bg-background/40 px-5 py-4 backdrop-blur',
        className
      )}
    >
      {/* Always-mounted audio element */}
      <audio ref={audioRef} src={src} preload="metadata" hidden />

      {/* Play / pause */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'إيقاف' : 'تشغيل'}
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-lg transition-all hover:scale-105 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        {status === 'loading' ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 translate-x-0.5" />
        )}
      </button>

      {/* Track + progress */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Volume2 className="h-4 w-4 text-primary" />
            {label}
          </span>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {formatTime(current)} / {formatTime(duration)}
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          {status === 'loading' || status === 'idle' ? (
            <div className="absolute inset-0 animate-pulse bg-muted" />
          ) : (
            <div
              className="absolute inset-y-0 right-0 rounded-full bg-brand-gradient transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          )}
        </div>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={reset}
        aria-label="إعادة"
        disabled={status === 'loading' || status === 'idle'}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 disabled:opacity-30',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  );
}
