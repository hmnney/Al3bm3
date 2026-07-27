'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Trash2, Dices, ArrowLeft, Check, RefreshCw } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { SectionHeader } from '@/components/layout/section-header';
import { BackButton } from '@/components/layout/back-button';
import { GameButton } from '@/components/game/game-button';
import { Input } from '@/components/ui/input';
import { useGame } from '@/components/providers/game-provider';
import type { RouletteAssignment } from '@/lib/types';

export default function RoulettePage() {
  const router = useRouter();
  const { state, setRoulettePlayers, makePlayer, spinRoulette, applyRouletteToTeams } = useGame();
  const [nameInput, setNameInput] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<RouletteAssignment | null>(null);

  const players = state.roulettePlayers;

  const addPlayer = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setRoulettePlayers([...players, makePlayer(trimmed)]);
    setNameInput('');
  };

  const removePlayer = (id: string) => {
    setRoulettePlayers(players.filter((p) => p.id !== id));
  };

  const handleSpin = () => {
    if (players.length < 2) return;
    setSpinning(true);
    setResult(null);
    // Brief spin animation delay; the real split is random and instant.
    window.setTimeout(() => {
      const assignment = spinRoulette();
      setResult(assignment);
      setSpinning(false);
    }, 2200);
  };

  const handleApplyAndContinue = () => {
    if (!result) return;
    applyRouletteToTeams(result);
    router.push('/teams');
  };

  const handleReturnHome = () => {
    router.push('/');
  };

  const canSpin = players.length >= 2 && !spinning;

  return (
    <PageShell>
      <div className="mb-8 flex items-center justify-between">
        <BackButton href="/" />
      </div>

      <SectionHeader
        title="روليت"
        subtitle="أضيفوا أسماء اللاعبين، ثم لُفوا العجلة لتقسيمهم عشوائياً على فريقين"
      />

      {/* Player entry */}
      <div className="mx-auto mt-10 w-full max-w-xl">
        <div className="flex gap-3">
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            placeholder="اكتب اسم اللاعب"
            maxLength={20}
            className="h-12 border-2 bg-background/60 text-lg font-semibold"
          />
          <GameButton size="md" onClick={addPlayer} disabled={!nameInput.trim()}>
            <UserPlus className="h-5 w-5" />
            إضافة
          </GameButton>
        </div>

        {/* Player chips */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          {players.length === 0 && (
            <p className="text-sm text-muted-foreground">
              لم تضيفوا أي لاعب بعد — أضيفوا لاعبين على الأقل للبدء
            </p>
          )}
          {players.map((p, i) => (
            <div
              key={p.id}
              className="group inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 py-1.5 pl-2 pr-4 text-sm font-semibold backdrop-blur animate-scale-in"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-xs font-black text-white">
                {i + 1}
              </span>
              {p.name}
              <button
                onClick={() => removePlayer(p.id)}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                aria-label={`حذف ${p.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Spin wheel */}
      <div className="mx-auto mt-12 flex w-full max-w-md flex-col items-center">
        <div
          className={`relative flex h-56 w-56 items-center justify-center rounded-full border-4 border-primary/40 bg-card/40 backdrop-blur ${
            spinning ? 'animate-spin' : ''
          }`}
          style={spinning ? { animationDuration: '1.2s' } : undefined}
        >
          {/* Wheel segments */}
          <div className="absolute inset-3 rounded-full bg-gradient-conic from-primary via-secondary to-primary-glow opacity-80" />
          <div className="absolute inset-6 rounded-full bg-card/90 backdrop-blur" />
          <Dices
            className={`relative h-20 w-20 text-primary ${spinning ? 'animate-pulse' : ''}`}
          />
          {/* Pointer */}
          <div className="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-8 border-t-[16px] border-x-transparent border-t-primary drop-shadow-lg" />
        </div>

        {!result && (
          <GameButton
            size="lg"
            onClick={handleSpin}
            disabled={!canSpin}
            className="mt-8 w-full max-w-xs"
          >
            <Dices className="h-5 w-5" />
            {spinning ? 'جاري الدوران...' : 'لُف العجلة'}
          </GameButton>
        )}
        {players.length < 2 && !result && (
          <p className="mt-3 text-sm text-muted-foreground">
            أضيفوا لاعبين على الأقل للدوران
          </p>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="mx-auto mt-10 w-full max-w-2xl animate-scale-in">
          <div className="mb-4 flex items-center justify-center gap-2 text-lg font-bold text-foreground">
            <Check className="h-5 w-5 text-success" />
            تم تقسيم اللاعبين!
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5">
              <h3 className="mb-3 text-lg font-black text-primary">الفريق الأول</h3>
              <ul className="flex flex-col gap-2">
                {result.team1.map((p) => (
                  <li key={p.id} className="rounded-lg bg-card/60 px-4 py-2 font-semibold backdrop-blur">
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-secondary/40 bg-secondary/5 p-5">
              <h3 className="mb-3 text-lg font-black text-secondary">الفريق الثاني</h3>
              <ul className="flex flex-col gap-2">
                {result.team2.map((p) => (
                  <li key={p.id} className="rounded-lg bg-card/60 px-4 py-2 font-semibold backdrop-blur">
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <GameButton variant="outline" size="md" onClick={handleSpin}>
              <RefreshCw className="h-4 w-4" />
              إعادة الدوران
            </GameButton>
            <GameButton size="lg" onClick={handleApplyAndContinue}>
              متابعة لإعداد الفريقين
              <ArrowLeft className="h-5 w-5" />
            </GameButton>
          </div>
        </div>
      )}

      {/* Return home (always available) */}
      <div className="mt-12 flex justify-center">
        <button
          onClick={handleReturnHome}
          className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          العودة للرئيسية
        </button>
      </div>
    </PageShell>
  );
}
