'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { SectionHeader } from '@/components/layout/section-header';
import { BackButton } from '@/components/layout/back-button';
import { GameButton } from '@/components/game/game-button';
import { TeamSetupCard } from '@/components/game/team-setup-card';
import { useGame } from '@/components/providers/game-provider';

export default function TeamsPage() {
  const router = useRouter();
  const { state, setTeamName, setTeamColor } = useGame();
  const [team1, team2] = state.teams;

  const canContinue = team1.name.trim().length > 0 && team2.name.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    router.push('/categories');
  };

  return (
    <PageShell>
      <div className="mb-8 flex items-center justify-between">
        <BackButton href="/" />
      </div>

      <SectionHeader
        title="اختيار الفريقين"
        subtitle="سمّوا فريقكم واختاروا لونكم — كل فريق يأخذ هواهً خاصاً به على لوحة المباراة"
        step={1}
        totalSteps={3}
      />

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        <TeamSetupCard
          team={team1}
          index={0}
          otherTeamColorId={team2.colorId}
          onNameChange={(name) => setTeamName('team-1', name)}
          onColorChange={(colorId) => setTeamColor('team-1', colorId)}
        />
        <TeamSetupCard
          team={team2}
          index={1}
          otherTeamColorId={team1.colorId}
          onNameChange={(name) => setTeamName('team-2', name)}
          onColorChange={(colorId) => setTeamColor('team-2', colorId)}
        />
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        <GameButton
          size="xl"
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full max-w-md"
        >
          متابعة
          <ArrowLeft className="h-6 w-6" />
        </GameButton>
        {!canContinue && (
          <p className="text-sm text-muted-foreground">
            اكتبوا اسم الفريقين للمتابعة
          </p>
        )}
      </div>
    </PageShell>
  );
}
