'use client';

import { useRouter } from 'next/navigation';
import { Trophy, Home, Users, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { SectionHeader } from '@/components/layout/section-header';
import { GameButton } from '@/components/game/game-button';
import { useGame } from '@/components/providers/game-provider';
import { CATEGORY_MAP } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function SummaryPage() {
  const router = useRouter();
  const { state, resetToHome } = useGame();

  const [team1, team2] = state.teams;
  const history = state.answerHistory;

  const totalQuestions = state.questionSlots.length || history.length;
  const answered = history.length;
  const correct = history.filter((h) => h.result !== 'none').length;
  const wrong = history.filter((h) => h.result === 'none').length;
  const unanswered = Math.max(0, totalQuestions - answered);

  const t1Correct = history.filter((h) => h.winnerTeamId === 'team-1').length;
  const t2Correct = history.filter((h) => h.winnerTeamId === 'team-2').length;

  const t1Score = team1.score;
  const t2Score = team2.score;

  const tie = t1Score === t2Score;
  const winner = t1Score > t2Score ? team1 : t2Score > t1Score ? team2 : null;

  const handleHome = () => {
    resetToHome();
    router.push('/');
  };

  // If a user lands here with no match, send them home.
  if (totalQuestions === 0) {
    return (
      <PageShell className="items-center justify-center text-center">
        <p className="mb-6 text-lg text-muted-foreground">
          لا يوجد ملخص لعرضه
        </p>
        <GameButton size="lg" onClick={handleHome}>
          العودة للرئيسية
        </GameButton>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <SectionHeader title="ملخص المباراة" subtitle="إليكم نتيجة الجلسة" />

      {/* Winner banner */}
      <div className="mx-auto mt-10 w-full max-w-3xl">
        {winner ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-primary/50 bg-card/60 p-8 text-center backdrop-blur glow-primary animate-scale-in">
            <Trophy className="h-14 w-14 text-primary animate-float" />
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              الفائز
            </p>
            <h2 className="bg-gradient-to-l from-primary via-primary-glow to-secondary bg-clip-text text-4xl font-black text-transparent sm:text-5xl">
              {winner.name}
            </h2>
            <p className="text-lg font-bold text-foreground">
              النتيجة النهائية: {winner.score} نقطة
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-secondary/50 bg-card/60 p-8 text-center backdrop-blur glow-secondary animate-scale-in">
            <Users className="h-14 w-14 text-secondary animate-float" />
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              النتيجة
            </p>
            <h2 className="text-4xl font-black text-foreground sm:text-5xl">
              تعادل!
            </h2>
            <p className="text-lg font-bold text-muted-foreground">
              الفريقان حصلا على {t1Score} نقطة
            </p>
          </div>
        )}
      </div>

      {/* Both teams' scores */}
      <div className="mx-auto mt-8 grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
        <TeamSummaryCard
          name={team1.name}
          score={t1Score}
          correct={t1Correct}
          isWinner={winner?.id === team1.id}
          tone="primary"
        />
        <TeamSummaryCard
          name={team2.name}
          score={t2Score}
          correct={t2Correct}
          isWinner={winner?.id === team2.id}
          tone="secondary"
        />
      </div>

      {/* Stats grid */}
      <div className="mx-auto mt-8 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<CheckCircle2 className="h-6 w-6" />}
          label="أسئلة مُجابة"
          value={answered}
          tone="success"
        />
        <StatCard
          icon={<CheckCircle2 className="h-6 w-6" />}
          label="إجابات صحيحة"
          value={correct}
          tone="success"
        />
        <StatCard
          icon={<XCircle className="h-6 w-6" />}
          label="إجابات خاطئة"
          value={wrong}
          tone="destructive"
        />
        <StatCard
          icon={<MinusCircle className="h-6 w-6" />}
          label="أسئلة بدون إجابة"
          value={unanswered}
          tone="muted"
        />
      </div>

      {/* Question log */}
      {history.length > 0 && (
        <div className="mx-auto mt-10 w-full max-w-3xl">
          <h3 className="mb-3 px-1 text-sm font-bold text-muted-foreground">
            سجل الأسئلة
          </h3>
          <div className="flex flex-col gap-2">
            {history.map((h, i) => {
              const cat = CATEGORY_MAP[h.categoryId];
              const label =
                h.result === 'current'
                  ? 'الفريق الحالي'
                  : h.result === 'opponent'
                  ? 'الفريق الآخر'
                  : 'بدون إجابة';
              const tone =
                h.result === 'none'
                  ? 'text-muted-foreground border-border/60'
                  : 'text-success border-success/40';
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-4 py-3 backdrop-blur"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/60 text-sm">
                      {cat?.glyph ?? '?'}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {cat?.name ?? 'تصنيف'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {h.points} نقطة
                      </p>
                    </div>
                  </div>
                  <span className={cn('rounded-full border px-3 py-1 text-xs font-bold', tone)}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-12 flex justify-center">
        <GameButton size="xl" onClick={handleHome} className="w-full max-w-md">
          <Home className="h-6 w-6" />
          العودة للرئيسية
        </GameButton>
      </div>
    </PageShell>
  );
}

function TeamSummaryCard({
  name,
  score,
  correct,
  isWinner,
  tone,
}: {
  name: string;
  score: number;
  correct: number;
  isWinner: boolean;
  tone: 'primary' | 'secondary';
}) {
  const accent =
    tone === 'primary'
      ? 'border-primary/40 bg-primary/5'
      : 'border-secondary/40 bg-secondary/5';
  return (
    <div className={cn('rounded-2xl border-2 p-6 text-center', accent)}>
      {isWinner && <Trophy className="mx-auto mb-2 h-7 w-7 text-primary" />}
      <h3 className="text-2xl font-black text-foreground">{name}</h3>
      <p className="mt-2 text-5xl font-black tabular-nums text-foreground">
        {score}
      </p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        {correct} إجابة صحيحة
      </p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'success' | 'destructive' | 'muted';
}) {
  const tones: Record<string, string> = {
    success: 'border-success/40 bg-success/5 text-success',
    destructive: 'border-destructive/40 bg-destructive/5 text-destructive',
    muted: 'border-border/60 bg-muted/20 text-muted-foreground',
  };
  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-2xl border-2 p-5 text-center', tones[tone])}>
      {icon}
      <span className="text-3xl font-black tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}
