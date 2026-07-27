import type {
  CategoryId,
  GameState,
  QuestionSlot,
  PointValue,
  RoulettePlayer,
  Team,
  TimerPresetSeconds,
} from './types';
import { POINT_VALUES, DEFAULT_TEAM_NAMES } from './constants';

/**
 * Creates the full set of question slots for a match.
 *
 * For every selected category and every point value, both teams get their own
 * slot — so the board shows 6 categories × 3 points × 2 teams = 36 slots.
 * Each slot is just a placeholder; the actual question is drawn from the bank
 * when the button is pressed (see drawQuestionForSlot).
 */
export function buildQuestionSlots(
  categoryIds: CategoryId[]
): QuestionSlot[] {
  const slots: QuestionSlot[] = [];
  for (const categoryId of categoryIds) {
    for (const points of POINT_VALUES) {
      (['team-1', 'team-2'] as const).forEach((team) => {
        slots.push({
          categoryId,
          points,
          team,
          completed: false,
        });
      });
    }
  }
  return slots;
}

export function createDefaultTeams(): [Team, Team] {
  return [
    {
      id: 'team-1',
      name: DEFAULT_TEAM_NAMES[0],
      colorId: 'purple',
      score: 0,
    },
    {
      id: 'team-2',
      name: DEFAULT_TEAM_NAMES[1],
      colorId: 'blue',
      score: 0,
    },
  ];
}

export function createDefaultState(): GameState {
  return {
    phase: 'home',
    currentTeamId: 'team-1',
    roulettePlayers: [],
    rouletteAssignment: null,
    teams: createDefaultTeams(),
    selectedCategoryIds: [],
    questionSlots: [],
    usedQuestionIds: [],
    answerHistory: [],
    settings: {
      soundEnabled: true,
      musicEnabled: true,
      perQuestionSeconds: 30,
      confirmEndMatch: true,
      autoSwitchTurn: true,
      showCompletedCounter: true,
      largeTimer: true,
      darkMode: false,
    },
  };
}

export const TIMER_PRESETS: TimerPresetSeconds[] = [30, 45, 60, 90, 120];

/** Stable id generator for roulette players (no DB involved). */
export function createPlayerId(): string {
  return `player_${Math.random().toString(36).slice(2, 10)}`;
}

export function createRoulettePlayer(name: string): RoulettePlayer {
  return { id: createPlayerId(), name: name.trim() };
}

/**
 * Splits a list of players into two teams as evenly as possible, randomly.
 * Used by the roulette result.
 */
export function splitIntoTeams(players: RoulettePlayer[]): {
  team1: RoulettePlayer[];
  team2: RoulettePlayer[];
} {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const mid = Math.ceil(shuffled.length / 2);
  return {
    team1: shuffled.slice(0, mid),
    team2: shuffled.slice(mid),
  };
}

export const POINT_VALUE_KEYS: PointValue[] = POINT_VALUES;
