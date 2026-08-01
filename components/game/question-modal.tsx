'use client';

import { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Eye,
  Check,
  X,
  Minus,
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import type { ActiveQuestion, Team } from '@/lib/types';
import { TEAM_COLOR_MAP, CATEGORY_MAP } from '@/lib/constants';
import {
  questionImageUrl,
  questionAudioUrl,
  questionVideoUrl,
} from '@/lib/media';
import { useCountdownTimer } from '@/hooks/use-countdown-timer';
import { GameButton } from './game-button';
import { MediaImage } from './media-image';
import { AudioPlayer } from './audio-player';
import { VideoPlayer } from './video-player';

interface QuestionModalProps {
  question: ActiveQuestion | null;
  currentTeam: Team;
  opponentTeam: Team;
  timerSeconds: number;
  largeTimer: boolean;
  onClose: () => void;
  onResult: (
    question: ActiveQuestion,
    result: 'current' | 'opponent' | 'none'
  ) => void;
}

function formatMMSS(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function QuestionModal({
  question,
  currentTeam,
  opponentTeam,
  timerSeconds,
  largeTimer,
  onClose,
  onResult,
}: QuestionModalProps) {
  const open = question !== null;
  const [revealed, setRevealed] = useState(false);
  const timer = useCountdownTimer(timerSeconds);

  // Auto-start the timer whenever a new question opens, and reset reveal state.
  useEffect(() => {
    if (open) {
      setRevealed(false);
      timer.startFresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, question?.question.id, question?.team]);

  const category = question ? CATEGORY_MAP[question.question.categoryId] : null;
  const currentColor = TEAM_COLOR_MAP[currentTeam.colorId];

  const handleResult = (result: 'current' | 'opponent' | 'none') => {
    if (!question) return;
    onResult(question, result);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const timerColor = timer.seconds <= 10 ? 'text-destructive' : 'text-foreground';
  const timerWarn = timer.seconds <= 10;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-transparent p-4 outline-none sm:p-8',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        >
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border-2 bg-card/90 backdrop-blur-xl">
            {/* ---- Top section ---- */}
            <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4 sm:px-8">
              {/* Left: large timer */}
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    'font-black tabular-nums tracking-tight',
                    largeTimer ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl',
                    timerColor,
                    timerWarn && 'animate-pulse'
                  )}
                >
                  {formatMMSS(timer.seconds)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  الوقت المتبقي
                </span>
              </div>

              {/* Center: current team + score */}
              <div className="flex flex-col items-center text-center">
                <span className="text-lg font-bold text-foreground sm:text-2xl">
                  {currentTeam.name}
                </span>
                <span
                  className="text-base font-semibold sm:text-lg"
                  style={{ color: `hsl(${currentColor.hsl})` }}
                >
                  {currentTeam.score} نقطة
                </span>
              </div>

              {/* Right: timer controls */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5">
                  <TimerCtrl
                    label="تشغيل"
                    icon={<Play className="h-4 w-4" />}
                    onClick={timer.start}
                    disabled={timer.running || timer.seconds === 0}
                  />
                  <TimerCtrl
                    label="إيقاف"
                    icon={<Pause className="h-4 w-4" />}
                    onClick={timer.pause}
                    disabled={!timer.running}
                  />
                  <TimerCtrl
                    label="إعادة"
                    icon={<RotateCcw className="h-4 w-4" />}
                    onClick={timer.reset}
                  />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  تحكم المؤقت
                </span>
              </div>
            </div>

            {/* ---- Center: question content ---- */}
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-8 text-center sm:px-10">
              {category && (
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-4 py-1.5">
                  <span className="text-xl">{category.glyph}</span>
                  <span className="text-sm font-bold text-foreground">
                    {category.name}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-black text-white"
                    style={{ backgroundColor: `hsl(${currentColor.hsl})` }}
                  >
                    {question?.question.points}
                  </span>
                </div>
              )}

              {/* Question text */}
              <div className="max-w-3xl">
                <p className="text-2xl font-bold leading-snug text-foreground sm:text-3xl md:text-4xl">
                  {question?.question.question}
                </p>
              </div>

              {/* Multiple Choice Options — render when questionType is set
                  OR when option fields are present (handles data imported
                  before questionType was added, or snake_case keys). */}
              {(() => {
                const q = question?.question;
                if (!q) return null;
                const isMC =
                  q.questionType === 'multiple_choice' ||
                  !!(q.optionA || q.optionB || q.optionC || q.optionD);
                if (!isMC) return null;
                const opts: [string, string | undefined][] = [
                  ['A', q.optionA],
                  ['B', q.optionB],
                  ['C', q.optionC],
                  ['D', q.optionD],
                ];
                const hasAny = opts.some(([, v]) => v);
                if (!hasAny) return null;
                return (
                  <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                    {opts.map(([letter, text]) =>
                      text ? (
                        <div
                          key={letter}
                          className="flex items-center gap-3 rounded-2xl border-2 border-border/60 bg-card/60 px-4 py-3 text-left"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-sm font-black text-white">
                            {letter}
                          </span>
                          <span className="text-base font-bold text-foreground sm:text-lg">
                            {text}
                          </span>
                        </div>
                      ) : null
                    )}
                  </div>
                );
              })()}

              {/* Media: image / audio / video */}
              {question?.question.image && (
                <div className="w-full max-w-2xl">
                  <MediaImage
                    src={questionImageUrl(question.question.image)}
                    alt="صورة السؤال"
                    className="aspect-video w-full rounded-2xl border-2 border-border/60 bg-card/60"
                  />
                </div>
              )}

              {question?.question.audio && (
                <div className="w-full max-w-2xl">
                  <AudioPlayer
                    src={questionAudioUrl(question.question.audio)}
                    label="صوت السؤال"
                  />
                </div>
              )}

              {question?.question.video && (
                <div className="w-full max-w-2xl">
                  <VideoPlayer
                    src={questionVideoUrl(question.question.video)}
                  />
                </div>
              )}

              {/* Reveal answer */}
              {!revealed ? (
                <GameButton
                  variant="outline"
                  size="lg"
                  onClick={() => setRevealed(true)}
                >
                  <Eye className="h-5 w-5" />
                  إظهار الإجابة
                </GameButton>
              ) : (
                <div className="flex w-full max-w-3xl flex-col items-center gap-6 animate-scale-in">
                  <div className="w-full rounded-2xl border-2 border-success/40 bg-success/10 px-6 py-5 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-success">
                      الإجابة
                    </p>
                    <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                      {question?.question.answer}
                    </p>
                    {(() => {
                      const q = question?.question;
                      if (!q) return null;
                      const opts: [string, string | undefined][] = [
                        ['A', q.optionA],
                        ['B', q.optionB],
                        ['C', q.optionC],
                        ['D', q.optionD],
                      ];
                      const match = opts.find(
                        ([, v]) =>
                          v && v.trim().toLowerCase() === q.answer.trim().toLowerCase()
                      );
                      return match ? (
                        <p className="mt-2 text-sm font-bold text-success/80">
                          الخيار {match[0]}
                        </p>
                      ) : null;
                    })()}
                  </div>

                  <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
                    <ResultButton
                      onClick={() => handleResult('current')}
                      icon={<Check className="h-6 w-6" />}
                      label="الفريق الحالي جاوب صح"
                      tone="success"
                    />
                    <ResultButton
                      onClick={() => handleResult('opponent')}
                      icon={<X className="h-6 w-6" />}
                      label="الفريق الآخر جاوب صح"
                      tone="secondary"
                    />
                    <ResultButton
                      onClick={() => handleResult('none')}
                      icon={<Minus className="h-6 w-6" />}
                      label="محد جاوب"
                      tone="muted"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="border-t border-border/60 px-5 py-3 text-center sm:px-8">
              <p className="text-xs text-muted-foreground">
                إغلاق النافذة لا يُعيد المؤقت — استخدموا زر الإعادة
              </p>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function TimerCtrl({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-background/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      {icon}
    </button>
  );
}

function ResultButton({
  onClick,
  icon,
  label,
  tone,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: 'success' | 'secondary' | 'muted';
}) {
  const tones: Record<string, string> = {
    success: 'border-success/50 bg-success/10 text-success hover:bg-success/20',
    secondary: 'border-secondary/50 bg-secondary/10 text-secondary hover:bg-secondary/20',
    muted: 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5 text-center transition-all hover:-translate-y-0.5 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        tones[tone]
      )}
    >
      {icon}
      <span className="text-sm font-bold sm:text-base">{label}</span>
    </button>
  );
}
