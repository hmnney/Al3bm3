'use client';

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type {
  CategoryId,
  GameState,
  QuestionSlot,
  RoulettePlayer,
  RouletteAssignment,
  Team,
  TeamColorId,
  GameSettings,
} from '@/lib/types';
import {
  createDefaultState,
  createDefaultTeams,
  buildQuestionSlots,
  createRoulettePlayer,
  splitIntoTeams,
} from '@/lib/game';
import { REQUIRED_CATEGORY_COUNT } from '@/lib/constants';
import {
  readStoredSettings,
  writeStoredSettings,
} from '@/hooks/use-persisted-settings';
import type { AnswerRecord } from '@/lib/types';

type Action =
  | { type: 'SET_PHASE'; phase: GameState['phase'] }
  | { type: 'SET_ROULETTE_PLAYERS'; players: RoulettePlayer[] }
  | { type: 'SET_ROULETTE_ASSIGNMENT'; assignment: RouletteAssignment }
  | { type: 'APPLY_ROULETTE_TO_TEAMS'; assignment: RouletteAssignment }
  | { type: 'SET_TEAM_NAME'; teamId: Team['id']; name: string }
  | { type: 'SET_TEAM_COLOR'; teamId: Team['id']; colorId: TeamColorId }
  | { type: 'SET_TEAMS'; teams: [Team, Team] }
  | { type: 'TOGGLE_CATEGORY'; categoryId: CategoryId }
  | { type: 'CLEAR_CATEGORIES' }
  | { type: 'START_MATCH'; categoryIds: CategoryId[] }
  | { type: 'MARK_SLOT_COMPLETED'; categoryId: CategoryId; points: number; team: QuestionSlot['team'] }
  | { type: 'ADD_SCORE'; teamId: Team['id']; points: number }
  | { type: 'SWITCH_TURN' }
  | { type: 'SET_CURRENT_TEAM'; teamId: Team['id'] }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<GameSettings> }
  | { type: 'HYDRATE_SETTINGS'; settings: GameSettings }
  | { type: 'RECORD_ANSWER'; record: AnswerRecord }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'MARK_QUESTION_USED'; questionId: string }
  | { type: 'RESET_ALL' }
  | { type: 'RESET_TO_HOME' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'SET_ROULETTE_PLAYERS':
      return { ...state, roulettePlayers: action.players };

    case 'SET_ROULETTE_ASSIGNMENT':
      return { ...state, rouletteAssignment: action.assignment };

    case 'APPLY_ROULETTE_TO_TEAMS': {
      const { assignment } = action;
      const team1Name =
        assignment.team1.map((p) => p.name).join(' و ') ||
        state.teams[0].name;
      const team2Name =
        assignment.team2.map((p) => p.name).join(' و ') ||
        state.teams[1].name;
      return {
        ...state,
        rouletteAssignment: assignment,
        teams: [
          { ...state.teams[0], name: team1Name },
          { ...state.teams[1], name: team2Name },
        ],
      };
    }

    case 'SET_TEAM_NAME':
      return {
        ...state,
        teams: state.teams.map((t) =>
          t.id === action.teamId ? { ...t, name: action.name } : t
        ) as [Team, Team],
      };

    case 'SET_TEAM_COLOR':
      return {
        ...state,
        teams: state.teams.map((t) =>
          t.id === action.teamId ? { ...t, colorId: action.colorId } : t
        ) as [Team, Team],
      };

    case 'SET_TEAMS':
      return { ...state, teams: action.teams };

    case 'TOGGLE_CATEGORY': {
      const exists = state.selectedCategoryIds.includes(action.categoryId);
      if (exists) {
        return {
          ...state,
          selectedCategoryIds: state.selectedCategoryIds.filter(
            (id) => id !== action.categoryId
          ),
        };
      }
      if (state.selectedCategoryIds.length >= REQUIRED_CATEGORY_COUNT) {
        return state;
      }
      return {
        ...state,
        selectedCategoryIds: [
          ...state.selectedCategoryIds,
          action.categoryId,
        ],
      };
    }

    case 'CLEAR_CATEGORIES':
      return { ...state, selectedCategoryIds: [] };

    case 'START_MATCH':
      return {
        ...state,
        selectedCategoryIds: action.categoryIds,
        questionSlots: buildQuestionSlots(action.categoryIds),
        teams: state.teams.map((t) => ({ ...t, score: 0 })) as [Team, Team],
        currentTeamId: 'team-1',
        usedQuestionIds: [],
        answerHistory: [],
        phase: 'board',
      };

    case 'MARK_SLOT_COMPLETED':
      return {
        ...state,
        questionSlots: state.questionSlots.map((slot) =>
          slot.categoryId === action.categoryId &&
          slot.points === action.points &&
          slot.team === action.team
            ? { ...slot, completed: true }
            : slot
        ),
      };

    case 'ADD_SCORE':
      return {
        ...state,
        teams: state.teams.map((t) =>
          t.id === action.teamId
            ? { ...t, score: t.score + action.points }
            : t
        ) as [Team, Team],
      };

    case 'SWITCH_TURN':
      return {
        ...state,
        currentTeamId:
          state.currentTeamId === 'team-1' ? 'team-2' : 'team-1',
      };

    case 'SET_CURRENT_TEAM':
      return { ...state, currentTeamId: action.teamId };

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case 'HYDRATE_SETTINGS':
      return { ...state, settings: action.settings };

    case 'RECORD_ANSWER':
      return {
        ...state,
        answerHistory: [...state.answerHistory, action.record],
      };

    case 'CLEAR_HISTORY':
      return { ...state, answerHistory: [] };

    case 'MARK_QUESTION_USED':
      if (state.usedQuestionIds.includes(action.questionId)) return state;
      return {
        ...state,
        usedQuestionIds: [...state.usedQuestionIds, action.questionId],
      };

    case 'RESET_ALL':
      return createDefaultState();

    case 'RESET_TO_HOME':
      return { ...createDefaultState(), phase: 'home' };

    default:
      return state;
  }
}

interface GameContextValue {
  state: GameState;
  setPhase: (phase: GameState['phase']) => void;
  setRoulettePlayers: (players: RoulettePlayer[]) => void;
  spinRoulette: () => RouletteAssignment | null;
  applyRouletteToTeams: (assignment: RouletteAssignment) => void;
  setTeamName: (teamId: Team['id'], name: string) => void;
  setTeamColor: (teamId: Team['id'], colorId: TeamColorId) => void;
  setTeams: (teams: [Team, Team]) => void;
  toggleCategory: (categoryId: CategoryId) => void;
  clearCategories: () => void;
  startMatch: (categoryIds: CategoryId[]) => void;
  markSlotCompleted: (
    categoryId: CategoryId,
    points: number,
    team: QuestionSlot['team']
  ) => void;
  addScore: (teamId: Team['id'], points: number) => void;
  switchTurn: () => void;
  setCurrentTeam: (teamId: Team['id']) => void;
  recordAnswer: (record: AnswerRecord) => void;
  clearHistory: () => void;
  markQuestionUsed: (questionId: string) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  resetAll: () => void;
  resetToHome: () => void;
  /** Helper for roulette player creation so pages don't import game.ts directly. */
  makePlayer: (name: string) => RoulettePlayer;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createDefaultState);

  const setPhase = useCallback((phase: GameState['phase']) => {
    dispatch({ type: 'SET_PHASE', phase });
  }, []);

  const setRoulettePlayers = useCallback((players: RoulettePlayer[]) => {
    dispatch({ type: 'SET_ROULETTE_PLAYERS', players });
  }, []);

  const spinRoulette = useCallback((): RouletteAssignment | null => {
    if (state.roulettePlayers.length < 2) return null;
    const assignment = splitIntoTeams(state.roulettePlayers);
    dispatch({ type: 'SET_ROULETTE_ASSIGNMENT', assignment });
    return assignment;
  }, [state.roulettePlayers]);

  const applyRouletteToTeams = useCallback(
    (assignment: RouletteAssignment) => {
      dispatch({ type: 'APPLY_ROULETTE_TO_TEAMS', assignment });
    },
    []
  );

  const setTeamName = useCallback((teamId: Team['id'], name: string) => {
    dispatch({ type: 'SET_TEAM_NAME', teamId, name });
  }, []);

  const setTeamColor = useCallback(
    (teamId: Team['id'], colorId: TeamColorId) => {
      dispatch({ type: 'SET_TEAM_COLOR', teamId, colorId });
    },
    []
  );

  const setTeams = useCallback((teams: [Team, Team]) => {
    dispatch({ type: 'SET_TEAMS', teams });
  }, []);

  const toggleCategory = useCallback((categoryId: CategoryId) => {
    dispatch({ type: 'TOGGLE_CATEGORY', categoryId });
  }, []);

  const clearCategories = useCallback(() => {
    dispatch({ type: 'CLEAR_CATEGORIES' });
  }, []);

  const startMatch = useCallback((categoryIds: CategoryId[]) => {
    dispatch({ type: 'START_MATCH', categoryIds });
  }, []);

  const markSlotCompleted = useCallback(
    (categoryId: CategoryId, points: number, team: QuestionSlot['team']) => {
      dispatch({
        type: 'MARK_SLOT_COMPLETED',
        categoryId,
        points,
        team,
      });
    },
    []
  );

  const addScore = useCallback((teamId: Team['id'], points: number) => {
    dispatch({ type: 'ADD_SCORE', teamId, points });
  }, []);

  const switchTurn = useCallback(() => {
    dispatch({ type: 'SWITCH_TURN' });
  }, []);

  const setCurrentTeam = useCallback((teamId: Team['id']) => {
    dispatch({ type: 'SET_CURRENT_TEAM', teamId });
  }, []);

  const recordAnswer = useCallback((record: AnswerRecord) => {
    dispatch({ type: 'RECORD_ANSWER', record });
  }, []);

  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, []);

  const markQuestionUsed = useCallback((questionId: string) => {
    dispatch({ type: 'MARK_QUESTION_USED', questionId });
  }, []);

  const updateSettings = useCallback((settings: Partial<GameSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings });
  }, []);

  const resetAll = useCallback(() => {
    dispatch({ type: 'RESET_ALL' });
  }, []);

  const resetToHome = useCallback(() => {
    dispatch({ type: 'RESET_TO_HOME' });
  }, []);

  // Hydrate persisted settings once on mount.
  useEffect(() => {
    const stored = readStoredSettings();
    if (stored) dispatch({ type: 'HYDRATE_SETTINGS', settings: stored });
  }, []);

  const makePlayer = useCallback((name: string) => {
    return createRoulettePlayer(name);
  }, []);

  // Persist settings whenever they change (after hydration).
  useEffect(() => {
    writeStoredSettings(state.settings);
  }, [state.settings]);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      setPhase,
      setRoulettePlayers,
      spinRoulette,
      applyRouletteToTeams,
      setTeamName,
      setTeamColor,
      setTeams,
      toggleCategory,
      clearCategories,
      startMatch,
      markSlotCompleted,
      addScore,
      switchTurn,
      setCurrentTeam,
      recordAnswer,
      clearHistory,
      markQuestionUsed,
      updateSettings,
      resetAll,
      resetToHome,
      makePlayer,
    }),
    [
      state,
      setPhase,
      setRoulettePlayers,
      spinRoulette,
      applyRouletteToTeams,
      setTeamName,
      setTeamColor,
      setTeams,
      toggleCategory,
      clearCategories,
      startMatch,
      markSlotCompleted,
      addScore,
      switchTurn,
      setCurrentTeam,
      recordAnswer,
      clearHistory,
      markQuestionUsed,
      updateSettings,
      resetAll,
      resetToHome,
      makePlayer,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return ctx;
}
