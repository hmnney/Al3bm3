'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Play,
  RotateCcw,
  Users,
  FolderTree,
  CheckCircle2,
  QrCode,
  Sparkles,
  Eye,
  Check,
  X,
  Minus,
  ArrowLeft,
  Home,
} from 'lucide-react';
import { useGame } from '@/components/providers/game-provider';
import { useInteractive } from '../interactive/_lib';
import { getPlugin } from '../interactive/_lib/registry';
import { registerAllPlugins } from '../interactive/_lib/plugins';
import { AdminPageHeader } from '../_components/admin-page-header';
import { BoardHeader } from '@/components/game/board-header';
import { BoardCategoryCard } from '@/components/game/board-category-card';
import { QuestionModal } from '@/components/game/question-modal';
import { GameButton } from '@/components/game/game-button';
import { CATEGORY_MAP, TEAM_COLORS, TEAM_COLOR_MAP, REQUIRED_CATEGORY_COUNT, POINT_VALUES } from '@/lib/constants';
import { drawQuestionForSlot } from '@/data';
import { useAdmin } from '../_lib/admin-context';
import type { AdminQuestion } from '../_lib/types';
import type { Question } from '@/lib/types';
import type {
  ActiveQuestion,
  AnswerRecord,
  CategoryId,
  PointValue,
  QuestionSlot,
  Team,
  TeamColorId,
} from '@/lib/types';
import type { InteractiveCategory } from '../interactive/_lib/types';
import { cn } from '@/lib/utils';

// Ensure plugins are registered for the gameplay component lookup.
registerAllPlugins();

type TestPhase = 'setup' | 'playing';

export default function TestModePage() {
  const game = useGame();
  const { state, setTeams, startMatch, markSlotCompleted, markQuestionUsed, addScore, switchTurn, recordAnswer, resetAll } = game;
  const { categories: interactiveCategories, createSession, sessions } = useInteractive();
  const { data: adminData } = useAdmin();

  // Build the question pool from the persisted admin store — same source as the real game.
  const questionPool: Question[] = adminData.questions.map((q: AdminQuestion) => ({
    id: q.id,
    categoryId: q.categoryId as CategoryId,
    difficulty: q.difficulty,
    points: q.points,
    question: q.question,
    answer: q.answer,
    image: q.image,
    audio: q.audio,
    video: q.video,
  }));

  const [phase, setPhase] = useState<TestPhase>('setup');
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);
  const [interactiveTest, setInteractiveTest] = useState<{
    category: InteractiveCategory;
    team: QuestionSlot['team'];
  } | null>(null);

  // ---- Setup state ----
  const [team1Name, setTeam1Name] = useState(state.teams[0].name);
  const [team2Name, setTeam2Name] = useState(state.teams[1].name);
  const [team1Color, setTeam1Color] = useState<TeamColorId>(state.teams[0].colorId);
  const [team2Color, setTeam2Color] = useState<TeamColorId>(state.teams[1].colorId);
  const [selectedCats, setSelectedCats] = useState<CategoryId[]>([]);

  const settings = state.settings;

  const toggleCat = (id: CategoryId) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleStart = () => {
    if (selectedCats.length < REQUIRED_CATEGORY_COUNT) return;
    setTeams([
      { id: 'team-1', name: team1Name.trim() || 'الفريق الأول', colorId: team1Color, score: 0 },
      { id: 'team-2', name: team2Name.trim() || 'الفريق الثاني', colorId: team2Color, score: 0 },
    ]);
    startMatch(selectedCats);
    setPhase('playing');
  };

  const handleReset = () => {
    resetAll();
    setSelectedCats([]);
    setActiveQuestion(null);
    setInteractiveTest(null);
    setPhase('setup');
  };

  // ---- Playing phase handlers ----
  const currentTeam = state.currentTeamId === 'team-1' ? state.teams[0] : state.teams[1];
  const opponentTeam = state.currentTeamId === 'team-1' ? state.teams[1] : state.teams[0];

  const handleAnswer = (
    categoryId: CategoryId,
    points: PointValue,
    team: QuestionSlot['team']
  ) => {
    const slot = state.questionSlots.find(
      (s) => s.categoryId === categoryId && s.points === points && s.team === team
    );
    if (slot?.completed) return;

    // Check if this is an interactive category
    const interactiveCat = interactiveCategories.find(
      (ic) => ic.id === categoryId && ic.enabled
    );
    if (interactiveCat) {
      setInteractiveTest({ category: interactiveCat, team });
      return;
    }

    const question = drawQuestionForSlot(categoryId, points, state.usedQuestionIds, questionPool);
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
    if (!interactiveTest) return;
    const { category, team } = interactiveTest;
    // Find the points from the slot — interactive categories use 500 as default
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
    setInteractiveTest(null);
    if (settings.autoSwitchTurn) switchTurn();
  };

  const totalSlots = state.questionSlots.length;
  const completedSlots = state.questionSlots.filter((s) => s.completed).length;

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="وضع اختبار اللعبة"
        subtitle="اختبر اللعبة كاملة: الفرق، التصنيفات، الأسئلة، المؤقت، النقاط، والتصنيفات التفاعلية"
        actions={
          phase === 'playing' ? (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-full border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive transition-all hover:bg-destructive/20"
            >
              <RotateCcw className="h-4 w-4" />
              إنهاء الاختبار
            </button>
          ) : undefined
        }
      />

      {phase === 'setup' && (
        <SetupPhase
          team1Name={team1Name}
          team2Name={team2Name}
          team1Color={team1Color}
          team2Color={team2Color}
          setTeam1Name={setTeam1Name}
          setTeam2Name={setTeam2Name}
          setTeam1Color={setTeam1Color}
          setTeam2Color={setTeam2Color}
          selectedCats={selectedCats}
          toggleCat={toggleCat}
          interactiveCategories={interactiveCategories}
          onStart={handleStart}
        />
      )}

      {phase === 'playing' && (
        <PlayingPhase
          state={state}
          currentTeam={currentTeam}
          opponentTeam={opponentTeam}
          completedSlots={completedSlots}
          totalSlots={totalSlots}
          settings={settings}
          activeQuestion={activeQuestion}
          interactiveTest={interactiveTest}
          interactiveCategories={interactiveCategories}
          sessions={sessions}
          createSession={createSession}
          onAnswer={handleAnswer}
          onResult={handleResult}
          onInteractiveResult={handleInteractiveResult}
          onCloseQuestion={() => setActiveQuestion(null)}
          onCloseInteractive={() => setInteractiveTest(null)}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

// ============================================================
// SETUP PHASE
// ============================================================

function SetupPhase({
  team1Name,
  team2Name,
  team1Color,
  team2Color,
  setTeam1Name,
  setTeam2Name,
  setTeam1Color,
  setTeam2Color,
  selectedCats,
  toggleCat,
  interactiveCategories,
  onStart,
}: {
  team1Name: string;
  team2Name: string;
  team1Color: TeamColorId;
  team2Color: TeamColorId;
  setTeam1Name: (v: string) => void;
  setTeam2Name: (v: string) => void;
  setTeam1Color: (v: TeamColorId) => void;
  setTeam2Color: (v: TeamColorId) => void;
  selectedCats: CategoryId[];
  toggleCat: (id: CategoryId) => void;
  interactiveCategories: InteractiveCategory[];
  onStart: () => void;
}) {
  const canStart = selectedCats.length >= REQUIRED_CATEGORY_COUNT;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Teams setup */}
      <div className="rounded-2xl border-2 border-border/50 bg-card/40 p-5 backdrop-blur sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">اختر الفريقين</h3>
            <span className="text-xs text-muted-foreground">سمّ الفريقين واختر ألوانهما</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TeamSetupCard
            label="الفريق الأول"
            name={team1Name}
            setName={setTeam1Name}
            color={team1Color}
            setColor={setTeam1Color}
          />
          <TeamSetupCard
            label="الفريق الثاني"
            name={team2Name}
            setName={setTeam2Name}
            color={team2Color}
            setColor={setTeam2Color}
          />
        </div>
      </div>

      {/* Categories selection */}
      <div className="rounded-2xl border-2 border-border/50 bg-card/40 p-5 backdrop-blur sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <FolderTree className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">اختر التصنيفات</h3>
            <span className="text-xs text-muted-foreground">
              اختر {REQUIRED_CATEGORY_COUNT} تصنيفات على الأقل — بما فيها التصنيفات التفاعلية
            </span>
          </div>
        </div>

        {/* Interactive categories */}
        {interactiveCategories.filter((c) => c.enabled).length > 0 && (
          <div className="mb-4">
            <span className="mb-2 block text-xs font-black uppercase text-primary">تصنيفات تفاعلية</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {interactiveCategories
                .filter((c) => c.enabled)
                .map((ic) => (
                  <CategoryChip
                    key={ic.id}
                    id={ic.id as CategoryId}
                    name={ic.name}
                    glyph={getInteractiveGlyph(ic)}
                    selected={selectedCats.includes(ic.id as CategoryId)}
                    onToggle={() => toggleCat(ic.id as CategoryId)}
                    badge="تفاعلي"
                  />
                ))}
            </div>
          </div>
        )}

        {/* Standard categories */}
        <div>
          <span className="mb-2 block text-xs font-black uppercase text-muted-foreground">تصنيفات عادية</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Object.values(CATEGORY_MAP).map((cat) => (
              <CategoryChip
                key={cat.id}
                id={cat.id}
                name={cat.name}
                glyph={cat.glyph}
                selected={selectedCats.includes(cat.id)}
                onToggle={() => toggleCat(cat.id)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-bold text-muted-foreground">
            المختار: {selectedCats.length} / {REQUIRED_CATEGORY_COUNT} المطلوب
          </span>
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black shadow-lg transition-all',
              canStart
                ? 'bg-brand-gradient text-white hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]'
                : 'cursor-not-allowed bg-muted/30 text-muted-foreground'
            )}
          >
            <Play className="h-5 w-5" />
            بدء الاختبار
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamSetupCard({
  label,
  name,
  setName,
  color,
  setColor,
}: {
  label: string;
  name: string;
  setName: (v: string) => void;
  color: TeamColorId;
  setColor: (v: TeamColorId) => void;
}) {
  return (
    <div className="rounded-xl border-2 border-border/40 bg-background/40 p-4">
      <span className="mb-2 block text-xs font-bold text-muted-foreground">{label}</span>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-3 h-11 w-full rounded-lg border-2 border-border/50 bg-card/60 px-3 text-sm font-bold text-foreground outline-none transition-colors focus:border-primary"
        placeholder="اسم الفريق"
      />
      <div className="flex flex-wrap gap-2">
        {TEAM_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setColor(c.id)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg border-2 transition-all',
              color === c.id ? 'border-foreground scale-110' : 'border-transparent opacity-60 hover:opacity-100'
            )}
            style={{ backgroundColor: `hsl(${c.hsl})` }}
            aria-label={c.name}
          >
            {color === c.id && <Check className="h-4 w-4 text-white" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryChip({
  id: _id,
  name,
  glyph,
  selected,
  onToggle,
  badge,
}: {
  id: CategoryId;
  name: string;
  glyph: string;
  selected: boolean;
  onToggle: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-all',
        selected
          ? 'border-primary bg-primary/15 text-primary shadow-lg'
          : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      <span className="text-lg">{glyph}</span>
      <span className="flex-1 text-right">{name}</span>
      {badge && (
        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-black text-primary">
          {badge}
        </span>
      )}
      {selected && <CheckCircle2 className="h-4 w-4" />}
    </button>
  );
}

function getInteractiveGlyph(cat: InteractiveCategory): string {
  const plugin = getPlugin(cat.pluginId);
  if (cat.interactionType === 'qr') return '📱';
  if (cat.interactionType === 'audio') return '🎙️';
  if (cat.interactionType === 'video') return '🎬';
  if (plugin) return '🎮';
  return '🧩';
}

// ============================================================
// PLAYING PHASE
// ============================================================

function PlayingPhase({
  state,
  currentTeam,
  opponentTeam,
  completedSlots,
  totalSlots,
  settings,
  activeQuestion,
  interactiveTest,
  interactiveCategories,
  sessions,
  createSession,
  onAnswer,
  onResult,
  onInteractiveResult,
  onCloseQuestion,
  onCloseInteractive,
  onReset,
}: {
  state: ReturnType<typeof useGame>['state'];
  currentTeam: Team;
  opponentTeam: Team;
  completedSlots: number;
  totalSlots: number;
  settings: ReturnType<typeof useGame>['state']['settings'];
  activeQuestion: ActiveQuestion | null;
  interactiveTest: { category: InteractiveCategory; team: QuestionSlot['team'] } | null;
  interactiveCategories: InteractiveCategory[];
  sessions: ReturnType<typeof useInteractive>['sessions'];
  createSession: ReturnType<typeof useInteractive>['createSession'];
  onAnswer: (categoryId: CategoryId, points: PointValue, team: QuestionSlot['team']) => void;
  onResult: (active: ActiveQuestion, result: 'current' | 'opponent' | 'none') => void;
  onInteractiveResult: (result: 'current' | 'opponent' | 'none') => void;
  onCloseQuestion: () => void;
  onCloseInteractive: () => void;
  onReset: () => void;
}) {
  const allDone = completedSlots === totalSlots && totalSlots > 0;

  return (
    <div className="animate-fade-in space-y-5">
      <BoardHeader
        currentTeam={currentTeam}
        opponentTeam={opponentTeam}
        completedCount={completedSlots}
        totalCount={totalSlots}
        showCounter={settings.showCompletedCounter}
        className="mb-2"
      />

      {allDone && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-success/40 bg-success/10 px-6 py-5 text-center animate-scale-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <p className="text-lg font-bold text-foreground">
              اكتملت جميع الأسئلة — الاختبار نجح!
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-bold text-white shadow-lg"
          >
            <RotateCcw className="h-4 w-4" />
            اختبار جديد
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {state.selectedCategoryIds.map((categoryId) => {
          const category = CATEGORY_MAP[categoryId];
          const interactiveCat = interactiveCategories.find((ic) => ic.id === categoryId);
          const slots = state.questionSlots.filter((s) => s.categoryId === categoryId);

          if (interactiveCat) {
            return (
              <InteractiveBoardCard
                key={categoryId}
                category={interactiveCat}
                slots={slots}
                teams={state.teams}
                onAnswer={onAnswer}
              />
            );
          }

          if (!category) return null;
          return (
            <BoardCategoryCard
              key={categoryId}
              category={category}
              slots={slots}
              teams={state.teams}
              onAnswer={onAnswer}
            />
          );
        })}
      </div>

      {/* Standard question modal */}
      <QuestionModal
        question={activeQuestion}
        currentTeam={currentTeam}
        opponentTeam={opponentTeam}
        timerSeconds={settings.perQuestionSeconds}
        largeTimer={settings.largeTimer}
        onClose={onCloseQuestion}
        onResult={onResult}
      />

      {/* Interactive test modal */}
      {interactiveTest && (
        <InteractiveTestModal
          category={interactiveTest.category}
          currentTeam={currentTeam}
          opponentTeam={opponentTeam}
          sessions={sessions}
          createSession={createSession}
          onResult={onInteractiveResult}
          onClose={onCloseInteractive}
        />
      )}
    </div>
  );
}

// ============================================================
// INTERACTIVE BOARD CARD
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
  onAnswer: (categoryId: CategoryId, points: PointValue, team: QuestionSlot['team']) => void;
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
        allDone ? 'border-border/40 opacity-70' : 'border-primary/40 hover:border-primary/60'
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
// INTERACTIVE TEST MODAL
// ============================================================

function InteractiveTestModal({
  category,
  currentTeam,
  opponentTeam,
  sessions,
  createSession,
  onResult,
  onClose,
}: {
  category: InteractiveCategory;
  currentTeam: Team;
  opponentTeam: Team;
  sessions: ReturnType<typeof useInteractive>['sessions'];
  createSession: ReturnType<typeof useInteractive>['createSession'];
  onResult: (result: 'current' | 'opponent' | 'none') => void;
  onClose: () => void;
}) {
  const [sessionCreated, setSessionCreated] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const plugin = getPlugin(category.pluginId);
  const currentColor = TEAM_COLOR_MAP[currentTeam.colorId];

  // Create a QR session when the modal opens (for QR-type categories)
  useState(() => {
    if (category.interactionType === 'qr' && !sessionCreated) {
      const content = String(category.config.secretContent ?? 'كلمة سرية تجريبية');
      createSession({
        categoryId: category.id,
        secretContent: content,
        singleUse: Boolean(category.config.singleUse),
        expirationSeconds: Number(category.config.expirationSeconds ?? 120),
        connectionTimeoutSeconds: Number(category.config.connectionTimeoutSeconds ?? 60),
      });
      setSessionCreated(true);
    }
  });

  const sessionUrl = useMemo(() => {
    const catSessions = sessions.filter((s) => s.categoryId === category.id);
    const latest = catSessions[catSessions.length - 1];
    return latest ? `${window.location.origin}/join/${latest.id}` : '';
  }, [sessions, category.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-xl p-4 sm:p-8">
      <div className="mx-auto flex h-full max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border-2 bg-card/90 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-4 py-1.5">
            <span className="text-xl">{getInteractiveGlyph(category)}</span>
            <span className="text-sm font-bold text-foreground">{category.name}</span>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-black text-white"
              style={{ backgroundColor: `hsl(${currentColor.hsl})` }}
            >
              500
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border/60 bg-background/60 p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-8 text-center sm:px-10">
          {category.interactionType === 'qr' && (
            <QRTestContent
              category={category}
              sessionUrl={sessionUrl}
              plugin={plugin}
              revealed={revealed}
              setRevealed={setRevealed}
            />
          )}

          {(category.interactionType === 'audio' ||
            category.interactionType === 'video' ||
            category.interactionType === 'custom' ||
            category.interactionType === 'normal' ||
            category.interactionType === 'private-screen') && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Sparkles className="h-8 w-8" />
              </div>
              <p className="max-w-md text-sm text-muted-foreground">
                تصنيف تفاعلي من نوع "{category.interactionType}". هذا نوع تجريبي —
                تأكد من أن البيانات موجودة في إعدادات التصنيف التفاعلي.
              </p>
            </div>
          )}
        </div>

        {/* Result buttons */}
        <div className="border-t border-border/60 px-5 py-4 sm:px-8">
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            <ResultBtn
              onClick={() => onResult('current')}
              icon={<Check className="h-6 w-6" />}
              label="الفريق الحالي جاوب"
              tone="success"
            />
            <ResultBtn
              onClick={() => onResult('opponent')}
              icon={<X className="h-6 w-6" />}
              label="الفريق الآخر جاوب"
              tone="secondary"
            />
            <ResultBtn
              onClick={() => onResult('none')}
              icon={<Minus className="h-6 w-6" />}
              label="محد جاوب"
              tone="muted"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function QRTestContent({
  category,
  sessionUrl,
  plugin,
  revealed,
  setRevealed,
}: {
  category: InteractiveCategory;
  sessionUrl: string;
  plugin: ReturnType<typeof getPlugin>;
  revealed: boolean;
  setRevealed: (v: boolean) => void;
}) {
  // If the plugin has a GameplayComponent, render it
  if (plugin?.GameplayComponent && sessionUrl) {
    const Gameplay = plugin.GameplayComponent;
    return (
      <Gameplay
        category={category}
        sessionUrl={sessionUrl}
        onResult={() => setRevealed(true)}
      />
    );
  }

  // Fallback: show a generic QR display
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="flex items-center gap-2 rounded-full bg-amber-500/15 px-4 py-2 text-sm font-black text-amber-500">
        <QrCode className="h-4 w-4" />
        تصنيف QR — امسح الرمز للاختبار
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
      {revealed && (
        <div className="rounded-xl border-2 border-success/40 bg-success/10 px-4 py-2 text-sm font-bold text-success">
          تم اختبار الكشف عن المحتوى
        </div>
      )}
    </div>
  );
}

function ResultBtn({
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
