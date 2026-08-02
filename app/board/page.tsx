'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Home, CheckCircle2, AlertCircle, Play, Pause, RotateCcw } from 'lucide-react';
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
import { useCountdownTimer } from '@/hooks/use-countdown-timer';
import { CATEGORY_MAP, TEAM_COLOR_MAP, POINT_VALUES } from '@/lib/constants';
import { drawQuestionForSlot } from '@/data';
import { loadAdminData, loadAdminDataRemote } from '@/app/admin/_lib/store';
import type { AdminQuestion, AdminCategory } from '@/app/admin/_lib/types';
import { registerAllPlugins } from '@/app/admin/interactive/_lib/plugins';
import { getPlugin } from '@/app/admin/interactive/_lib/registry';
import {
  loadInteractiveCategories,
  loadInteractiveCategoriesRemote,
} from '@/app/admin/interactive/_lib/store';
import {
  initSessions,
  createSession as createQRSession,
  getAllSessions,
} from '@/app/admin/interactive/_lib/qr-session-manager';
import type { InteractiveCategory, QRSession } from '@/app/admin/interactive/_lib/types';
import {
  categoryImageUrl,
  questionImageUrl,
  questionAudioUrl,
  questionVideoUrl,
  preloadImage,
} from '@/lib/media';
import type {
  ActiveQuestion,
  AnswerRecord,
  CategoryId,
  PointValue,
  Question,
  QuestionSlot,
  Team,
  TimerPresetSeconds,
} from '@/lib/types';
import { cn } from '@/lib/utils';

// Ensure plugins are registered for the gameplay component lookup — the real
// game uses the exact same registration as Test Mode.
registerAllPlugins();

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

  // Load persisted interactive categories + initialize QR sessions directly
  // from the store — the real game doesn't depend on the admin InteractiveProvider.
  const [interactiveCats, setInteractiveCats] = useState<InteractiveCategory[]>(
    []
  );
  const [sessions, setSessions] = useState<QRSession[]>([]);
  useEffect(() => {
    setInteractiveCats(loadInteractiveCategories());
    initSessions();
    setSessions(getAllSessions());
    void loadInteractiveCategoriesRemote().then((result) => {
      if (result.status === 'found' && result.data) {
        setInteractiveCats(result.data);
        setSessions(getAllSessions());
      }
    });
  }, []);

  const createSession = useCallback(
    (input: {
      categoryId: string;
      secretContent: string;
      singleUse: boolean;
      expirationSeconds: number;
      connectionTimeoutSeconds: number;
    }) => {
      const s = createQRSession(input);
      setSessions(getAllSessions());
      return s;
    },
    []
  );

  // Load persisted admin questions once on mount. This is the ONLY question
  // source — there is no static demo fallback. We hydrate from localStorage
  // first (instant) then fetch from Supabase Storage (durable source of truth)
  // so that a fresh device with empty localStorage still receives the full
  // question bank imported on another device.
  const [adminQuestions, setAdminQuestions] = useState<AdminQuestion[]>([]);
  const [adminCategoriesById, setAdminCategoriesById] = useState<
    Record<string, AdminCategory>
  >({});

  const applyAdminData = useCallback((data: { questions: AdminQuestion[]; categories: AdminCategory[] }) => {
    setAdminQuestions(data.questions);
    const map: Record<string, AdminCategory> = {};
    data.categories.forEach((c) => {
      map[c.id] = c;
    });
    setAdminCategoriesById(map);
  }, []);

  useEffect(() => {
    const local = loadAdminData();
    applyAdminData(local);
    void loadAdminDataRemote().then((result) => {
      if (result.status === 'found' && result.data) {
        applyAdminData(result.data);
      }
    });
  }, [applyAdminData]);

  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(
    null
  );
  const [interactiveActive, setInteractiveActive] = useState<{
    category: InteractiveCategory;
    team: QuestionSlot['team'];
  } | null>(null);

  const settings = state.settings;

  // Build the Question[] pool from persisted admin data — the game draws
  // ONLY from this pool. No static demo bank.
  const questionPool: Question[] = useMemo(
    () =>
      adminQuestions.map((q: AdminQuestion) => ({
        id: q.id,
        categoryId: q.categoryId as CategoryId,
        difficulty: q.difficulty,
        points: q.points,
        question: q.question,
        answer: q.answer,
        image: q.image,
        audio: q.audio,
        video: q.video,
        questionType: q.questionType,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
      })),
    [adminQuestions]
  );

  const hasAnyQuestions = questionPool.length > 0;

  // Build a combined category lookup that includes admin-created categories
  // (from Smart Import or manual creation) alongside the static catalog.
  // Without this, the board can't render cards for imported categories.
  const combinedCategoryMap = useMemo(() => {
    const map = { ...CATEGORY_MAP };
    adminQuestions.forEach((q) => {
      const cid = q.categoryId;
      if (!map[cid]) {
        // Find the admin category to build a Category-shaped object.
        const adminCat = adminCategoriesById[cid];
        if (adminCat) {
          map[cid] = {
            id: cid as CategoryId,
            name: adminCat.name,
            description: adminCat.description,
            glyph: adminCat.glyph,
            gradient: adminCat.gradient,
          };
        }
      }
    });
    return map;
  }, [adminQuestions, adminCategoriesById]);

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
    const slot = state.questionSlots.find(
      (s) =>
        s.categoryId === categoryId &&
        s.points === points &&
        s.team === team
    );
    if (slot?.completed) return;

    // Interactive category? Route to the interactive gameplay modal.
    const interactiveCat = interactiveCats.find(
      (ic) => ic.id === categoryId && ic.enabled
    );
    if (interactiveCat) {
      setInteractiveActive({ category: interactiveCat, team });
      return;
    }

    // Standard question — draw from the persisted admin pool ONLY.
    const question = drawQuestionForSlot(
      categoryId,
      points,
      state.usedQuestionIds,
      questionPool
    );
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
    if (settings.autoSwitchTurn) switchTurn();
  };

  const handleInteractiveResult = (
    result: 'current' | 'opponent' | 'none'
  ) => {
    if (!interactiveActive) return;
    const { category, team } = interactiveActive;
    const points: PointValue = 500;
    let winnerTeamId: AnswerRecord['winnerTeamId'] = null;
    if (result === 'current') {
      addScore(currentTeam.id, points);
      winnerTeamId = currentTeam.id;
    } else if (result === 'opponent') {
      addScore(opponentTeam.id, points);
      winnerTeamId = opponentTeam.id;
    }
    recordAnswer({
      questionId: `interactive-${category.id}`,
      categoryId: category.id as CategoryId,
      points,
      slotTeam: team,
      result,
      winnerTeamId,
    });
    markSlotCompleted(category.id as CategoryId, points, team);
    setInteractiveActive(null);
    if (settings.autoSwitchTurn) switchTurn();
  };

  const totalSlots = state.questionSlots.length;
  const completedSlots = state.questionSlots.filter((s) => s.completed).length;
  const allDone = completedSlots === totalSlots && totalSlots > 0;

  const goToSummary = () => router.push('/summary');
  const handleEndMatch = () => {
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

  // Preload the active question's image the moment it's drawn so the modal
  // can paint it instantly. We only preload images (via new Image()) — audio
  // and video are loaded by their respective player components on demand,
  // so we don't block on external CORS preflight requests.
  useEffect(() => {
    const q = activeQuestion?.question;
    if (!q) return;
    if (q.image) preloadImage(questionImageUrl(q.image));
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

      {!hasAnyQuestions && (
        <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 px-6 py-8 text-center">
          <AlertCircle className="h-10 w-10 text-amber-500" />
          <p className="text-xl font-black text-foreground">
            لا توجد أسئلة متاحة
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            لم يتم استيراد أو إضافة أي أسئلة بعد. استخدم لوحة التحكم لإضافة
            الأسئلة أو استيرادها من ملف قبل بدء المباراة. التصنيفات التفاعلية
            تعمل بدون أسئلة.
          </p>
          <GameButton
            variant="outline"
            size="md"
            onClick={() => router.push('/admin/import')}
          >
            استيراد الأسئلة
          </GameButton>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {state.selectedCategoryIds.map((categoryId) => {
          const interactiveCat = interactiveCats.find(
            (ic) => ic.id === categoryId
          );
          const slots = state.questionSlots.filter(
            (s) => s.categoryId === categoryId
          );

          if (interactiveCat) {
            return (
              <InteractiveBoardCard
                key={categoryId}
                category={interactiveCat}
                slots={slots}
                teams={state.teams}
                onAnswer={handleAnswer}
              />
            );
          }

          const category = combinedCategoryMap[categoryId];
          if (!category) return null;
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

      {interactiveActive && (
        <InteractiveGameModal
          category={interactiveActive.category}
          currentTeam={currentTeam}
          timerSeconds={settings.perQuestionSeconds}
          largeTimer={settings.largeTimer}
          sessions={sessions}
          createSession={createSession}
          onResult={handleInteractiveResult}
          onClose={() => setInteractiveActive(null)}
        />
      )}
    </PageShell>
  );
}

// ============================================================
// INTERACTIVE BOARD CARD (mirrors Test Mode's InteractiveBoardCard)
// ============================================================

function InteractiveBoardCard({
  category,
  slots,
  teams,
  onAnswer,
}: {
  category: InteractiveCategory;
  slots: QuestionSlot[];
  teams: [Team, Team];
  onAnswer: (
    categoryId: CategoryId,
    points: PointValue,
    team: QuestionSlot['team']
  ) => void;
}) {
  const [team1, team2] = teams;
  const team1Color = TEAM_COLOR_MAP[team1.colorId];
  const team2Color = TEAM_COLOR_MAP[team2.colorId];
  const glyph = getInteractiveGlyph(category);
  const allDone = slots.length > 0 && slots.every((s) => s.completed);

  const isCompleted = (points: number, team: QuestionSlot['team']) =>
    slots.some(
      (s) =>
        s.categoryId === (category.id as CategoryId) &&
        s.points === points &&
        s.team === team &&
        s.completed
    );

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border-2 bg-card/50 backdrop-blur transition-all',
        allDone
          ? 'border-border/40 opacity-70'
          : 'border-primary/40 hover:border-primary/60'
      )}
    >
      <div className="relative flex h-28 items-center justify-center bg-primary/10 sm:h-32">
        <span className="text-5xl">{glyph}</span>
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <h3 className="absolute bottom-3 right-4 left-4 text-center text-xl font-black text-foreground drop-shadow-lg sm:text-2xl">
          {category.name}
        </h3>
        <div className="absolute right-3 top-3 rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-black text-primary">
          تفاعلي
        </div>
        {allDone && (
          <div className="absolute left-3 top-3 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-success backdrop-blur">
            تم إنهاء التصنيف
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="flex flex-col gap-2.5">
          {POINT_VALUES.map((points) => (
            <InteractivePointButton
              key={`t1-${points}`}
              points={points}
              completed={isCompleted(points, 'team-1')}
              teamHsl={team1Color.hsl}
              onClick={() => onAnswer(category.id as CategoryId, points, 'team-1')}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          {POINT_VALUES.map((points) => (
            <InteractivePointButton
              key={`t2-${points}`}
              points={points}
              completed={isCompleted(points, 'team-2')}
              teamHsl={team2Color.hsl}
              onClick={() => onAnswer(category.id as CategoryId, points, 'team-2')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function InteractivePointButton({
  points,
  completed,
  teamHsl,
  onClick,
}: {
  points: PointValue;
  completed: boolean;
  teamHsl: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={completed}
      onClick={onClick}
      className={cn(
        'group relative flex h-14 w-full items-center justify-center rounded-xl border-2 text-xl font-black transition-all duration-200 sm:h-16 sm:text-2xl',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        completed
          ? 'cursor-not-allowed border-border/40 bg-muted/30 text-muted-foreground/50'
          : 'hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
      )}
      style={
        completed
          ? undefined
          : {
              borderColor: `hsl(${teamHsl} / 0.55)`,
              backgroundColor: `hsl(${teamHsl} / 0.12)`,
              color: `hsl(${teamHsl})`,
            }
      }
      aria-label={`${points} نقطة${completed ? ' — مكتمل' : ''}`}
    >
      <span className="tabular-nums tracking-tight">{points}</span>
    </button>
  );
}

// ============================================================
// INTERACTIVE GAMEPLAY MODAL (mirrors Test Mode's InteractiveTestModal)
// ============================================================

function formatMMSS(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function InteractiveGameModal({
  category,
  currentTeam,
  timerSeconds,
  largeTimer,
  sessions,
  createSession,
  onResult,
  onClose,
}: {
  category: InteractiveCategory;
  currentTeam: Team;
  timerSeconds: TimerPresetSeconds;
  largeTimer: boolean;
  sessions: QRSession[];
  createSession: (input: {
    categoryId: string;
    secretContent: string;
    singleUse: boolean;
    expirationSeconds: number;
    connectionTimeoutSeconds: number;
  }) => QRSession;
  onResult: (result: 'current' | 'opponent' | 'none') => void;
  onClose: () => void;
}) {
  const [sessionCreated, setSessionCreated] = useState(false);
  const timer = useCountdownTimer(timerSeconds);

  // Auto-start the timer when the modal opens.
  useEffect(() => {
    timer.startFresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plugin = getPlugin(category.pluginId);
  const currentColor = TEAM_COLOR_MAP[currentTeam.colorId];
  const timerColor = timer.seconds <= 10 ? 'text-destructive' : 'text-foreground';
  const timerWarn = timer.seconds <= 10;

  // Create a QR session when the modal opens (for QR-type categories).
  useEffect(() => {
    if (category.interactionType === 'qr' && !sessionCreated) {
      const content = pickWordContent(category);
      createSession({
        categoryId: category.id,
        secretContent: content,
        singleUse: Boolean(category.config.singleUse),
        expirationSeconds: Number(category.config.expirationSeconds ?? 120),
        connectionTimeoutSeconds: Number(
          category.config.connectionTimeoutSeconds ?? 60
        ),
      });
      setSessionCreated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id]);

  const sessionUrl = useMemo(() => {
    const catSessions = sessions.filter((s) => s.categoryId === category.id);
    const latest = catSessions[catSessions.length - 1];
    return latest ? `${window.location.origin}/join/${latest.id}` : '';
  }, [sessions, category.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-xl p-4 sm:p-8">
      <div className="mx-auto flex h-full max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border-2 bg-card/90 backdrop-blur-xl">
        {/* Header — timer + category + close */}
        <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4 sm:px-8">
          {/* Left: timer */}
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

          {/* Center: category + points */}
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-4 py-1.5">
            <span className="text-xl">{getInteractiveGlyph(category)}</span>
            <span className="text-sm font-bold text-foreground">
              {category.name}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-black text-white"
              style={{ backgroundColor: `hsl(${currentColor.hsl})` }}
            >
              500
            </span>
          </div>

          {/* Right: timer controls + close */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={timer.start}
                disabled={timer.running || timer.seconds === 0}
                aria-label="تشغيل"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 disabled:opacity-30"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={timer.pause}
                disabled={!timer.running}
                aria-label="إيقاف"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 disabled:opacity-30"
              >
                <Pause className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={timer.reset}
                aria-label="إعادة"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-foreground transition-all hover:border-primary/50 hover:bg-primary/10"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Home className="h-4 w-4" />
              </button>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              تحكم المؤقت
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-8 text-center sm:px-10">
          {category.interactionType === 'qr' && (
            <QRGameContent
              category={category}
              sessionUrl={sessionUrl}
              plugin={plugin}
              timerSeconds={timerSeconds}
              largeTimer={largeTimer}
            />
          )}

          {category.interactionType !== 'qr' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <AlertCircle className="h-8 w-8" />
              </div>
              <p className="max-w-md text-sm text-muted-foreground">
                تصنيف تفاعلي من نوع &quot;{category.interactionType}&quot;.
                تأكد من أن البيانات موجودة في إعدادات التصنيف التفاعلي.
              </p>
            </div>
          )}
        </div>

        {/* Result buttons */}
        <div className="border-t border-border/60 px-5 py-4 sm:px-8">
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onResult('current')}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-success/50 bg-success/10 px-4 py-5 text-center text-success transition-all hover:-translate-y-0.5 hover:bg-success/20 active:scale-95"
            >
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-sm font-bold sm:text-base">
                الفريق الحالي جاوب
              </span>
            </button>
            <button
              type="button"
              onClick={() => onResult('opponent')}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-secondary/50 bg-secondary/10 px-4 py-5 text-center text-secondary transition-all hover:-translate-y-0.5 hover:bg-secondary/20 active:scale-95"
            >
              <AlertCircle className="h-6 w-6" />
              <span className="text-sm font-bold sm:text-base">
                الفريق الآخر جاوب
              </span>
            </button>
            <button
              type="button"
              onClick={() => onResult('none')}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border/60 bg-muted/30 px-4 py-5 text-center text-muted-foreground transition-all hover:-translate-y-0.5 hover:bg-muted/50 active:scale-95"
            >
              <Home className="h-6 w-6" />
              <span className="text-sm font-bold sm:text-base">محد جاوب</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QRGameContent({
  category,
  sessionUrl,
  plugin,
  timerSeconds,
  largeTimer,
}: {
  category: InteractiveCategory;
  sessionUrl: string;
  plugin: ReturnType<typeof getPlugin>;
  timerSeconds: number;
  largeTimer: boolean;
}) {
  // If the plugin has a GameplayComponent, render it — same as Test Mode.
  if (plugin?.GameplayComponent && sessionUrl) {
    const Gameplay = plugin.GameplayComponent;
    return (
      <Gameplay
        category={category}
        sessionUrl={sessionUrl}
        timerSeconds={timerSeconds}
        largeTimer={largeTimer}
        onResult={() => {
          /* result handled by parent's result buttons */
        }}
      />
    );
  }

  // Fallback: generic QR display
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="flex items-center gap-2 rounded-full bg-amber-500/15 px-4 py-2 text-sm font-black text-amber-500">
        <AlertCircle className="h-4 w-4" />
        تصنيف QR — امسح الرمز للمشاركة
      </div>
      <p className="max-w-md text-sm text-muted-foreground">
        المحتوى السري: {String(category.config.secretContent ?? 'غير محدد')}
      </p>
      {sessionUrl ? (
        <div className="rounded-2xl border-2 border-primary/30 bg-card/50 p-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(sessionUrl)}`}
            alt="QR Code"
            className="h-60 w-60"
          />
        </div>
      ) : (
        <div className="flex h-60 w-60 items-center justify-center rounded-2xl border-2 border-dashed border-border/40 bg-muted/20">
          <span className="text-sm text-muted-foreground">يجري إنشاء الجلسة…</span>
        </div>
      )}
    </div>
  );
}

/** Pick a random unused word from a word-only dataset, or fall back to config. */
function pickWordContent(category: InteractiveCategory): string {
  const ds = category.dataset;
  if (ds && ds.kind === 'word-only') {
    const available = ds.words.filter((w) => !ds.usedWords.includes(w));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
  }
  return String(category.config.secretContent ?? 'كلمة سرية');
}

function getInteractiveGlyph(cat: InteractiveCategory): string {
  const plugin = getPlugin(cat.pluginId);
  if (cat.interactionType === 'qr') return '📱';
  if (cat.interactionType === 'audio') return '🎙️';
  if (cat.interactionType === 'video') return '🎬';
  if (plugin) return '🎮';
  return '🧩';
}
