export type GamePhase =
  | 'home'
  | 'roulette'
  | 'teams'
  | 'categories'
  | 'board';

export type PointValue = 250 | 500 | 750;

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

/** A single banked question belonging to one category. */
export type QuestionType = 'normal' | 'multiple_choice';

export interface Question {
  /** Stable unique id within its category, e.g. "conan-250-1". */
  id: string;
  categoryId: CategoryId;
  difficulty: QuestionDifficulty;
  points: PointValue;
  question: string;
  answer: string;
  image?: string;
  audio?: string;
  video?: string;
  /** "normal" = text-only question; "multiple_choice" = shows A/B/C/D options. */
  questionType?: QuestionType;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
}

export type CategoryId =
  | 'conan'
  | 'movie-posters'
  | 'anime-posters'
  | 'game-posters'
  | 'football'
  | 'saudi-league'
  | 'wrestling'
  | 'order-events'
  | 'story-says'
  | 'guess-image'
  | 'general'
  | 'friends'
  | 'who-celebrity'
  | 'guess-celebration'
  | 'guess-voice';

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  /** Short emoji/icon glyph used as a placeholder until real art exists. */
  glyph: string;
  /** Gradient classes used for the placeholder art (Tailwind). */
  gradient: string;
}

export interface Team {
  id: 'team-1' | 'team-2';
  name: string;
  colorId: TeamColorId;
  score: number;
}

export type TeamColorId =
  | 'purple'
  | 'blue'
  | 'emerald'
  | 'rose'
  | 'amber'
  | 'cyan';

export interface TeamColor {
  id: TeamColorId;
  name: string;
  /** Tailwind-ready HSL string, e.g. "271 91% 65%". */
  hsl: string;
  /** A short gradient for swatches and accents. */
  gradient: string;
}

/**
 * A single question slot on the game board. The question content itself is
 * intentionally left empty — the question bank is a future feature and must
 * not be generated now.
 */
export interface QuestionSlot {
  categoryId: CategoryId;
  points: PointValue;
  team: 'team-1' | 'team-2';
  completed: boolean;
  // Reserved for future question-bank integration:
  // questionId?: string;
}

/** The question currently open in the board's question modal. */
export interface ActiveQuestion {
  question: Question;
  team: 'team-1' | 'team-2';
}

export interface RoulettePlayer {
  id: string;
  name: string;
}

export interface RouletteAssignment {
  team1: RoulettePlayer[];
  team2: RoulettePlayer[];
}

export type TimerPresetSeconds = 30 | 45 | 60 | 90 | 120;

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  perQuestionSeconds: TimerPresetSeconds;
  confirmEndMatch: boolean;
  autoSwitchTurn: boolean;
  showCompletedCounter: boolean;
  largeTimer: boolean;
  darkMode: boolean;
}

/** One resolved question, used to build the match summary stats. */
export interface AnswerRecord {
  questionId: string;
  categoryId: CategoryId;
  points: PointValue;
  /** The board column (slot) the question came from. */
  slotTeam: 'team-1' | 'team-2';
  /** Which result was chosen. */
  result: 'current' | 'opponent' | 'none';
  /** The team that received the points, or null if nobody answered. */
  winnerTeamId: 'team-1' | 'team-2' | null;
}

export interface GameState {
  phase: GamePhase;
  currentTeamId: 'team-1' | 'team-2';
  roulettePlayers: RoulettePlayer[];
  rouletteAssignment: RouletteAssignment | null;
  teams: [Team, Team];
  selectedCategoryIds: CategoryId[];
  questionSlots: QuestionSlot[];
  /** Ids of questions already used this match, so none repeats. */
  usedQuestionIds: string[];
  answerHistory: AnswerRecord[];
  settings: GameSettings;
}
