'use client';

import { useCallback, useEffect, useState } from 'react';

interface CountdownTimer {
  seconds: number;
  running: boolean;
  start: () => void;
  resume: () => void;
  pause: () => void;
  reset: () => void;
  startFresh: () => void;
}

/**
 * Self-contained MM:SS countdown. The ticking interval is tied only to
 * `running`, so pause/resume continue from the exact remaining seconds.
 * Reaching zero stops the timer automatically (no callback side-effects).
 */
export function useCountdownTimer(initialSeconds: number): CountdownTimer {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (seconds === 0) setRunning(false);
  }, [seconds]);

  const start = useCallback(() => setRunning(true), []);
  const resume = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);
  const reset = useCallback(() => {
    setRunning(false);
    setSeconds(initialSeconds);
  }, [initialSeconds]);
  const startFresh = useCallback(() => {
    setSeconds(initialSeconds);
    setRunning(true);
  }, [initialSeconds]);

  return { seconds, running, start, resume, pause, reset, startFresh };
}
