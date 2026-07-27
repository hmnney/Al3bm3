'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, CheckCircle2 } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { GameButton } from '@/components/game/game-button';
import { BoardCategoryCard } from '@/components/game/board-category-card';
import { BoardHeader } from '@/components/game/board-header';
import { QuestionModal } from '@/components/game/question-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useGame } from '@/components/providers/game-provider';
import { CATEGORY_MAP } from '@/lib/constants';
import { drawQuestionForSlot } from '@/data';
import {
  categoryImageUrl,
  questionImageUrl,
  questionAudioUrl,
  questionVideoUrl,
  preloadImage,
  preloadMediaUrl,
} from '@/lib/media';
import type {
  ActiveQuestion,
  AnswerRecord,
  CategoryId,
  PointValue,
  QuestionSlot,
} from '@/lib/types';

export default function BoardPage() {
  const router = useRouter();
  const {
    state,
    markSlotCompleted,
    markQuestionUsed,
    addScore,
    switchTurn,
    recordAnswer,
    resetToHome,
  } = useGame();
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(
    null
  );

  const settings = state.settings;

  // Guard: if no categories were selected, send the user back to setup.
  if (state.selectedCategoryIds.length === 0) {
    return (
      <PageShell className="items-center justify-center text-center">
        <p className="mb-6 text-lg text-muted-foreground">
          لم تبدأ أي مباراة بعد
        </p>
        <GameButton size="lg" onClick={() => router.push('/categories')}>
          اختيار التصنيفات
        </GameButton>
      </PageShell>
    );
  }

  const currentTeam =
    state.currentTeamId === 'team-1' ? state.teams[0] : state.teams[1];
  const opponentTeam =
    state.currentTeamId === 'team-1' ? state.teams[1] : state.teams[0];

  const handleAnswer = (
    categoryId: CategoryId,
    points: PointValue,
    team: QuestionSlot['team']
  ) => {
    // Already completed this slot — ignore (button should be disabled anyway).
    const slot = state.questionSlots.find(
      (s) =>
        s.categoryId === categoryId &&
        s.points === points &&
        s.team === team
    );
    if (slot?.completed) return;

    const question = drawQuestionForSlot(
      categoryId,
      points,
      state.usedQuestionIds
    );
    // No unused questions left at this tier — treat the slot as exhausted.
    if (!question) return;
    markQuestionUsed(question.id);
    setActiveQuestion({ question, team });
  };

  const handleResult = (
    active: ActiveQuestion,
    result: 'current' | 'opponent' | 'none'
  ) => {
    const { question } = active;
    let winnerTeamId: AnswerRecord['winnerTeamId'] = null;
    if (result === 'current') {
      addScore(currentTeam.id, question.points);
      winnerTeamId = currentTeam.id;
    } else if (result === 'opponent') {
      addScore(opponentTeam.id, question.points);
      winnerTeamId = opponentTeam.id;
    }
    recordAnswer({
      questionId: question.id,
      categoryId: question.categoryId,
      points: question.points,
      slotTeam: active.team,
      result,
      winnerTeamId,
    });
    markSlotCompleted(question.categoryId, question.points, active.team);
    setActiveQuestion(null);
    // Only switch turn when the setting is enabled.
    if (settings.autoSwitchTurn) switchTurn();
  };

  const totalSlots = state.questionSlots.length;
  const completedSlots = state.questionSlots.filter((s) => s.completed).length;
  const allDone = completedSlots === totalSlots && totalSlots > 0;

  const goToSummary = () => router.push('/summary');
  const handleEndMatch = () => {
    // Keep state intact so the summary page can read it, then reset after.
    router.push('/summary');
  };

  // Auto-end the match when every slot is resolved — open the summary.
  useEffect(() => {
    if (allDone) router.push('/summary');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  // Preload the selected categories' images once on mount so the board cards
  // can paint them instantly. Fire-and-forget; failures just keep the glyph.
  useEffect(() => {
    state.selectedCategoryIds.forEach((id) => {
      preloadImage(categoryImageUrl(id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload the active question's media the moment it's drawn, so by the time
  // the modal finishes opening the asset is likely cached. Each preload is
  // error-safe and runs only when that media field is present.
  useEffect(() => {
    const q = activeQuestion?.question;
    if (!q) return;
    if (q.image) preloadImage(questionImageUrl(q.image));
    if (q.audio) preloadMediaUrl(questionAudioUrl(q.audio));
    if (q.video) preloadMediaUrl(questionVideoUrl(q.video));
  }, [activeQuestion]);

  // When confirmation is disabled, the button ends immediately.
  const EndMatchButton = ({ onConfirm }: { onConfirm: () => void }) => {
    if (!settings.confirmEndMatch) {
      return (
        <GameButton
          variant="outline"
          size="lg"
          className="border-destructive/50 text-destructive hover:bg-destructive/10"
          onClick={onConfirm}
        >
          <Home className="h-5 w-5" />
          إنهاء المباراة
        </GameButton>
      );
    }
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <GameButton
            variant="outline"
            size="lg"
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <Home className="h-5 w-5" />
            إنهاء المباراة
          </GameButton>
        </AlertDialogTrigger>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">
              إنهاء المباراة؟
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              سيتم إنهاء المباراة وعرض ملخص النتيجة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">
              تراجع
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              إنهاء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return (
    <PageShell className="max-w-[1400px]">
      <BoardHeader
        currentTeam={currentTeam}
        opponentTeam={opponentTeam}
        completedCount={completedSlots}
        totalCount={totalSlots}
        showCounter={settings.showCompletedCounter}
        className="mb-6"
      />

      {allDone && (
        <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-success/40 bg-success/10 px-6 py-5 text-center animate-scale-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <p className="text-lg font-bold text-foreground">
              اكتملت جميع الأسئلة — مباراة رائعة!
            </p>
          </div>
          <GameButton size="md" onClick={goToSummary}>
            عرض ملخص المباراة
          </GameButton>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {state.selectedCategoryIds.map((categoryId) => {
          const category = CATEGORY_MAP[categoryId];
          if (!category) return null;
          const slots = state.questionSlots.filter(
            (s) => s.categoryId === categoryId
          );
          return (
            <BoardCategoryCard
              key={categoryId}
              category={category}
              slots={slots}
              teams={state.teams}
              onAnswer={handleAnswer}
            />
          );
        })}
      </div>

      <div className="mt-12 flex justify-center">
        <EndMatchButton onConfirm={handleEndMatch} />
      </div>

      <QuestionModal
        question={activeQuestion}
        currentTeam={currentTeam}
        opponentTeam={opponentTeam}
        timerSeconds={settings.perQuestionSeconds}
        largeTimer={settings.largeTimer}
        onClose={() => setActiveQuestion(null)}
        onResult={handleResult}
      />
    </PageShell>
  );
}
