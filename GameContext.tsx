import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import {
  Card,
  Role,
  Suit,
  assignRoles,
  checkPlayEffects,
  createDeck,
  dealCards,
  getPlayType,
  isForbiddenFinish,
  isValidPlay,
  shuffleDeck,
  sortHand,
} from '@/utils/gameEngine';
import { chooseCPUPlay } from '@/utils/cpuAI';
import { OnlineAction, useOnline } from '@/context/OnlineContext';

export type { Role } from '@/utils/gameEngine';

export type GameMode = 'cpu' | 'online';
export type Direction = 1 | -1;

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  isCPU: boolean;
  finishOrder: number | null;
  role: Role | null;
  forbiddenFinish: boolean;
}

export type PendingEffect =
  | {
      type: 'seven';
      sourcePlayerIndex: number;
      targetPlayerIndex: number;
      count: number;
      clearRound: boolean;
      skipCount: number;
      message: string;
    }
  | {
      type: 'ten';
      sourcePlayerIndex: number;
      count: number;
      clearRound: boolean;
      skipCount: number;
      message: string;
    }
  | {
      type: 'qBomber';
      sourcePlayerIndex: number;
      count: number;
      clearRound: boolean;
      skipCount: number;
      message: string;
    };

export type GamePhase = 'menu' | 'playing' | 'handover' | 'gameEnd';

export interface GameState {
  mode: GameMode;
  playerCount: number;
  players: Player[];
  currentPlayerIndex: number;
  localPlayerIndex: number;
  fieldCards: Card[] | null;
  fieldHistory: Card[][];
  lastPlayPlayerIndex: number | null;
  passCount: number;
  direction: Direction;
  revolution: boolean;
  jBack: boolean;
  suitShibari: Suit | null;
  stairShibari: boolean;
  phase: GamePhase;
  finishOrder: number[];
  previousRoles: Record<number, Role>;
  message: string;
  selectedCardIds: Set<string>;
  handoverRevealed: boolean;
  pendingEffect: PendingEffect | null;
}

export interface SerializedGameState {
  mode: 'online';
  playerCount: number;
  players: Array<Omit<Player, 'hand'> & { hand: Card[] }>;
  currentPlayerIndex: number;
  localPlayerIndex: number;
  fieldCards: Card[] | null;
  fieldHistory: Card[][];
  lastPlayPlayerIndex: number | null;
  passCount: number;
  direction: Direction;
  revolution: boolean;
  jBack: boolean;
  suitShibari: Suit | null;
  stairShibari: boolean;
  phase: GamePhase;
  finishOrder: number[];
  previousRoles: Record<number, Role>;
  message: string;
  selectedCardIds: string[];
  handoverRevealed: boolean;
  pendingEffect: PendingEffect | null;
}

type GameAction =
  | { type: 'START_GAME'; mode: GameMode; playerCount: number; playerNames?: string[]; localPlayerIndex?: number }
  | { type: 'TOGGLE_CARD'; cardId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'PLAY_CARDS' }
  | { type: 'PASS' }
  | { type: 'CPU_TAKE_TURN' }
  | { type: 'RESOLVE_PENDING_CARDS'; cardIds: string[] }
  | { type: 'RESOLVE_Q_BOMBER'; ranks: number[] }
  | { type: 'SKIP_PENDING' }
  | { type: 'REMOTE_PLAY_CARDS'; playerIndex: number; cardIds: string[] }
  | { type: 'REMOTE_PASS'; playerIndex: number }
  | { type: 'REMOTE_RESOLVE_PENDING_CARDS'; playerIndex: number; cardIds: string[] }
  | { type: 'REMOTE_RESOLVE_Q_BOMBER'; playerIndex: number; ranks: number[] }
  | { type: 'REMOTE_SKIP_PENDING'; playerIndex: number }
  | { type: 'REPLACE_ONLINE_STATE'; snapshot: SerializedGameState }
  | { type: 'REVEAL_HAND' }
  | { type: 'CONFIRM_HANDOVER' }
  | { type: 'NEW_GAME' }
  | { type: 'RESET_TO_MENU' };

function makeInitialState(): GameState {
  return {
    mode: 'cpu',
    playerCount: 4,
    players: [],
    currentPlayerIndex: 0,
    localPlayerIndex: 0,
    fieldCards: null,
    fieldHistory: [],
    lastPlayPlayerIndex: null,
    passCount: 0,
    direction: 1,
    revolution: false,
    jBack: false,
    suitShibari: null,
    stairShibari: false,
    phase: 'menu',
    finishOrder: [],
    previousRoles: {},
    message: '',
    selectedCardIds: new Set(),
    handoverRevealed: false,
    pendingEffect: null,
  };
}

function buildPlayers(mode: GameMode, playerCount: number, playerNames: string[] = []): Player[] {
  if (mode === 'cpu') {
    return [
      { id: 0, name: 'あなた', hand: [], isCPU: false, finishOrder: null, role: null, forbiddenFinish: false },
      ...Array.from({ length: playerCount - 1 }, (_, i) => ({
        id: i + 1,
        name: `CPU${i + 1}`,
        hand: [],
        isCPU: true,
        finishOrder: null,
        role: null,
        forbiddenFinish: false,
      })),
    ];
  }
  return Array.from({ length: playerCount }, (_, i) => ({
    id: i,
    name: playerNames[i] || `プレイヤー${i + 1}`,
    hand: [],
    isCPU: false,
    finishOrder: null,
    role: null,
    forbiddenFinish: false,
  }));
}

function hiddenHand(playerIndex: number, count: number): Card[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `hidden-${playerIndex}-${index}`,
    rank: 0,
    suit: 'joker' as const,
    isJoker: true,
  }));
}

function serializeStateForPlayer(state: GameState, playerIndex: number): SerializedGameState {
  return {
    mode: 'online',
    playerCount: state.playerCount,
    players: state.players.map((player, index) => ({
      ...player,
      hand: index === playerIndex ? player.hand : hiddenHand(index, player.hand.length),
    })),
    currentPlayerIndex: state.currentPlayerIndex,
    localPlayerIndex: playerIndex,
    fieldCards: state.fieldCards,
    fieldHistory: state.fieldHistory,
    lastPlayPlayerIndex: state.lastPlayPlayerIndex,
    passCount: state.passCount,
    direction: state.direction,
    revolution: state.revolution,
    jBack: state.jBack,
    suitShibari: state.suitShibari,
    stairShibari: state.stairShibari,
    phase: state.phase,
    finishOrder: state.finishOrder,
    previousRoles: state.previousRoles,
    message: state.message,
    selectedCardIds: [...state.selectedCardIds],
    handoverRevealed: true,
    pendingEffect: state.pendingEffect,
  };
}

function deserializeOnlineState(snapshot: SerializedGameState, previous: GameState): GameState {
  const localTurnIsStillActive =
    snapshot.currentPlayerIndex === snapshot.localPlayerIndex &&
    snapshot.phase === 'playing' &&
    !snapshot.pendingEffect;
  return {
    ...snapshot,
    selectedCardIds: localTurnIsStillActive
      ? previous.selectedCardIds
      : new Set(snapshot.selectedCardIds),
  };
}

function dealGame(players: Player[], revolution: boolean): Player[] {
  const hands = dealCards(shuffleDeck(createDeck()), players.length);
  return players.map((player, index) => ({
    ...player,
    hand: sortHand(hands[index], revolution),
    finishOrder: null,
    role: null,
    forbiddenFinish: false,
  }));
}

function findStartingPlayer(players: Player[]): number {
  const index = players.findIndex(player =>
    player.hand.some(card => card.rank === 3 && card.suit === 'spade')
  );
  return index >= 0 ? index : 0;
}

function effectiveRevolution(state: Pick<GameState, 'revolution' | 'jBack'>): boolean {
  return state.revolution !== state.jBack;
}

function activePlayerCount(players: Player[], finishOrder: number[]): number {
  return players.filter((player, index) =>
    player.hand.length > 0 && !finishOrder.includes(index)
  ).length;
}

function findNextActivePlayer(
  players: Player[],
  currentIndex: number,
  finishOrder: number[],
  direction: Direction,
  steps = 1,
): number {
  const count = players.length;
  let index = currentIndex;
  let moved = 0;
  while (moved < count * 2) {
    index = (index + direction + count) % count;
    if (finishOrder.includes(index) || players[index].hand.length === 0) continue;
    moved += 1;
    if (moved >= steps) return index;
  }
  return currentIndex;
}

function appendNewFinishers(
  players: Player[],
  finishOrder: number[],
  forbiddenOverrides: Record<number, boolean> = {},
): number[] {
  const result = [...finishOrder];
  players.forEach((player, index) => {
    if (player.hand.length === 0 && !result.includes(index)) {
      result.push(index);
    }
    if (forbiddenOverrides[index] !== undefined) {
      player.forbiddenFinish = forbiddenOverrides[index];
    }
  });
  return result;
}

function orderFinishers(players: Player[], finishOrder: number[]): number[] {
  const legal = finishOrder.filter(index => !players[index]?.forbiddenFinish);
  const forbidden = finishOrder.filter(index => players[index]?.forbiddenFinish);
  return [...legal, ...forbidden];
}

function endGame(
  state: GameState,
  players: Player[],
  finishOrder: number[],
  message: string,
): GameState {
  const rawOrder = appendNewFinishers(players, finishOrder);
  // ゲーム終了時は最後まで手札が残ったプレイヤーも最下位として順位に含める。
  const remainingPlayers = players
    .map((_, index) => index)
    .filter(index => !rawOrder.includes(index));
  const finalOrder = orderFinishers(players, [...rawOrder, ...remainingPlayers]);
  const roles = assignRoles(finalOrder, state.playerCount);
  const finalPlayers = players.map((player, index) => ({
    ...player,
    finishOrder: finalOrder.indexOf(index) + 1,
    role: roles[index] ?? null,
  }));
  return {
    ...state,
    players: finalPlayers,
    finishOrder: finalOrder,
    previousRoles: roles,
    selectedCardIds: new Set(),
    pendingEffect: null,
    phase: 'gameEnd',
    message,
  };
}

function shouldHandover(state: GameState, players: Player[], nextIndex: number): boolean {
  return false;
}

function moveToNextTurn(
  state: GameState,
  players: Player[],
  finishOrder: number[],
  nextIndex: number,
  fieldCards: Card[] | null,
  fieldHistory: Card[][],
  message: string,
  clearRound: boolean,
  suitShibari: Suit | null,
  stairShibari: boolean,
  jBack: boolean,
): GameState {
  const handover = shouldHandover(state, players, nextIndex);
  return {
    ...state,
    players,
    finishOrder,
    currentPlayerIndex: nextIndex,
    fieldCards,
    fieldHistory,
    passCount: 0,
    suitShibari: clearRound ? null : suitShibari,
    stairShibari: clearRound ? false : stairShibari,
    jBack: clearRound ? false : jBack,
    selectedCardIds: new Set(),
    phase: handover ? 'handover' : 'playing',
    handoverRevealed: handover ? false : true,
    message,
  };
}

function completePendingEffect(
  state: GameState,
  players: Player[],
  finishOrder: number[],
  messageOverride?: string,
): GameState {
  const pending = state.pendingEffect;
  if (!pending) return state;
  const source = pending.sourcePlayerIndex;
  const nextFinishOrder = appendNewFinishers(players, finishOrder);

  if (activePlayerCount(players, nextFinishOrder) <= 1) {
    return endGame(state, players, nextFinishOrder, messageOverride ?? pending.message);
  }

  const activeCount = activePlayerCount(players, nextFinishOrder);
  const startNewRound = pending.clearRound || pending.skipCount >= Math.max(1, activeCount - 1);
  const nextIndex = startNewRound
    ? (players[source]?.hand.length > 0 ? source : findNextActivePlayer(players, source, nextFinishOrder, state.direction))
    : findNextActivePlayer(players, source, nextFinishOrder, state.direction, pending.skipCount + 1);

  return moveToNextTurn(
    { ...state, pendingEffect: null },
    players,
    nextFinishOrder,
    nextIndex,
    startNewRound ? null : state.fieldCards,
    startNewRound ? [] : state.fieldHistory,
    messageOverride ?? pending.message,
    startNewRound,
    state.suitShibari,
    state.stairShibari,
    state.jBack,
  );
}

function resolveSeven(
  state: GameState,
  cardIds: string[],
): GameState {
  const pending = state.pendingEffect;
  if (!pending || pending.type !== 'seven') return state;
  const source = state.players[pending.sourcePlayerIndex];
  const target = state.players[pending.targetPlayerIndex];
  const selected = source.hand.filter(card => cardIds.includes(card.id)).slice(0, pending.count);
  if (selected.length !== pending.count) return { ...state, message: `${pending.count}枚選んでください` };
  const players = state.players.map((player, index) => {
    if (index === pending.sourcePlayerIndex) {
      return { ...player, hand: sortHand(player.hand.filter(card => !cardIds.includes(card.id)), effectiveRevolution(state) ) };
    }
    if (index === pending.targetPlayerIndex) {
      return { ...player, hand: sortHand([...player.hand, ...selected], effectiveRevolution(state)) };
    }
    return player;
  });
  return completePendingEffect(state, players, state.finishOrder, `${source.name}が${target.name}へ${pending.count}枚渡しました`);
}

function resolveTen(
  state: GameState,
  cardIds: string[],
): GameState {
  const pending = state.pendingEffect;
  if (!pending || pending.type !== 'ten') return state;
  const source = state.players[pending.sourcePlayerIndex];
  const selected = source.hand.filter(card => cardIds.includes(card.id)).slice(0, pending.count);
  if (selected.length !== pending.count) return { ...state, message: `${pending.count}枚選んでください` };
  const players = state.players.map((player, index) =>
    index === pending.sourcePlayerIndex
      ? { ...player, hand: sortHand(player.hand.filter(card => !cardIds.includes(card.id)), effectiveRevolution(state)) }
      : player
  );
  return completePendingEffect(state, players, state.finishOrder, `${source.name}が${pending.count}枚捨てました`);
}

function resolveQBombe(state: GameState, ranks: number[]): GameState {
  const pending = state.pendingEffect;
  if (!pending || pending.type !== 'qBomber') return state;
  const uniqueRanks = [...new Set(ranks)];
  if (uniqueRanks.length !== pending.count) {
    return { ...state, message: `${pending.count}種類選んでください` };
  }
  const players = state.players.map(player => ({
    ...player,
    hand: sortHand(
      player.hand.filter(card => !uniqueRanks.includes(card.isJoker ? 0 : card.rank)),
      effectiveRevolution(state),
    ),
  }));
  const nextFinishOrder = appendNewFinishers(players, state.finishOrder);
  return completePendingEffect(
    state,
    players,
    nextFinishOrder,
    `Qボンバー！ ${uniqueRanks.map(rank => rank === 0 ? 'Joker' : `${rank}`).join('・')}を捨てました`,
  );
}

function applyPlay(state: GameState, played: Card[]): GameState {
  if (state.phase !== 'playing' || state.pendingEffect) return state;
  const current = state.players[state.currentPlayerIndex];
  const revolutionForPlay = effectiveRevolution(state);
  if (!current) return state;
  if (getPlayType(played) === 'invalid') return { ...state, message: '無効な手です' };
  if (!isValidPlay(played, state.fieldCards, revolutionForPlay, state.suitShibari, state.stairShibari)) {
    return { ...state, message: '出せない手です' };
  }

  const effects = checkPlayEffects(
    played,
    state.fieldCards,
    state.suitShibari,
    state.stairShibari,
    revolutionForPlay,
  );
  const playedIds = new Set(played.map(card => card.id));
  const newRevolution = effects.isRevolution ? !state.revolution : state.revolution;
  const newJBack = effects.isJBack ? !state.jBack : state.jBack;
  const newEffectiveRevolution = newRevolution !== newJBack;
  let players = state.players.map((player, index) =>
    index === state.currentPlayerIndex
      ? { ...player, hand: sortHand(player.hand.filter(card => !playedIds.has(card.id)), newEffectiveRevolution) }
      : { ...player },
  );

  let finishOrder = [...state.finishOrder];
  const currentHandEmpty = players[state.currentPlayerIndex].hand.length === 0;
  if (currentHandEmpty && !finishOrder.includes(state.currentPlayerIndex)) {
    finishOrder.push(state.currentPlayerIndex);
    players[state.currentPlayerIndex].forbiddenFinish =
      isForbiddenFinish(played, revolutionForPlay);
  }

  // Qボンバーは場に出したQを除く全員の手札にも適用する。
  if (effects.qBomberCount > 0) {
    // 選択は後で行う。Qを出した時点の場は保持し、解決後に流す。
  }

  const partialClear = effects.isEightCut;
  const fullFiveSkip = effects.fiveSkipCount >= Math.max(
    1,
    activePlayerCount(players, finishOrder) - 1,
  );
  // Qボンバーは手札だけを処理し、8切りのように場を流す効果ではない。
  const clearRound = partialClear || fullFiveSkip;
  const nextDirection: Direction = effects.isNineReverse
    ? (state.direction === 1 ? -1 : 1)
    : state.direction;
  const nextSuitShibari = clearRound ? null : effects.newSuitShibari;
  const nextStairShibari = clearRound ? false : effects.newStairShibari;
  const nextJBack = clearRound ? false : newJBack;
  const effectText = effects.isRevolution
    ? `${current.name} → 革命！`
    : effects.isEightCut
      ? `${current.name} → 8切り！`
      : effects.qBomberCount > 0
        ? `${current.name} → Qボンバー！`
        : effects.isJBack
          ? `${current.name} → Jバック！`
          : `${current.name}が${played.length}枚出しました`;

  const baseState: GameState = {
    ...state,
    players,
    finishOrder,
    direction: nextDirection,
    revolution: newRevolution,
    jBack: nextJBack,
    fieldCards: played,
    fieldHistory: [...state.fieldHistory, played],
    lastPlayPlayerIndex: state.currentPlayerIndex,
    suitShibari: nextSuitShibari,
    stairShibari: nextStairShibari,
    selectedCardIds: new Set(),
    message: effectText,
  };

  if (effects.sevenPassCount > 0 && players[state.currentPlayerIndex].hand.length > 0) {
    const target = findNextActivePlayer(players, state.currentPlayerIndex, finishOrder, nextDirection);
    return {
      ...baseState,
      currentPlayerIndex: state.currentPlayerIndex,
      pendingEffect: {
        type: 'seven',
        sourcePlayerIndex: state.currentPlayerIndex,
        targetPlayerIndex: target,
        count: Math.min(effects.sevenPassCount, players[state.currentPlayerIndex].hand.length),
        clearRound,
        skipCount: effects.fiveSkipCount,
        message: effectText,
      },
    };
  }
  if (effects.tenDiscardCount > 0 && players[state.currentPlayerIndex].hand.length > 0) {
    return {
      ...baseState,
      currentPlayerIndex: state.currentPlayerIndex,
      pendingEffect: {
        type: 'ten',
        sourcePlayerIndex: state.currentPlayerIndex,
        count: Math.min(effects.tenDiscardCount, players[state.currentPlayerIndex].hand.length),
        clearRound,
        skipCount: effects.fiveSkipCount,
        message: effectText,
      },
    };
  }
  if (effects.qBomberCount > 0) {
    return {
      ...baseState,
      currentPlayerIndex: state.currentPlayerIndex,
      pendingEffect: {
        type: 'qBomber',
        sourcePlayerIndex: state.currentPlayerIndex,
        count: effects.qBomberCount,
        clearRound: false,
        skipCount: 0,
        message: effectText,
      },
    };
  }

  const nextFinishOrder = appendNewFinishers(players, finishOrder);
  if (activePlayerCount(players, nextFinishOrder) <= 1) {
    return endGame(baseState, players, nextFinishOrder, `${current.name}が上がりました！`);
  }

  const startsNewRound = clearRound;
  const nextIndex = startsNewRound
    ? (players[state.currentPlayerIndex].hand.length > 0
      ? state.currentPlayerIndex
      : findNextActivePlayer(players, state.currentPlayerIndex, nextFinishOrder, nextDirection))
    : findNextActivePlayer(
      players,
      state.currentPlayerIndex,
      nextFinishOrder,
      nextDirection,
      effects.fiveSkipCount + 1,
    );
  return moveToNextTurn(
    baseState,
    players,
    nextFinishOrder,
    nextIndex,
    startsNewRound ? null : played,
    startsNewRound ? [] : [...state.fieldHistory, played],
    effectText,
    startsNewRound,
    nextSuitShibari,
    nextStairShibari,
    nextJBack,
  );
}

function passTurn(state: GameState, allowCPU = false): GameState {
  if (state.phase !== 'playing' || state.pendingEffect) return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current || (!allowCPU && current.isCPU)) return state;
  const active = activePlayerCount(state.players, state.finishOrder);
  const nextPassCount = state.passCount + 1;
  if (nextPassCount >= Math.max(1, active - 1)) {
    const starter = state.lastPlayPlayerIndex !== null &&
      state.players[state.lastPlayPlayerIndex]?.hand.length > 0
      ? state.lastPlayPlayerIndex
      : findNextActivePlayer(state.players, state.currentPlayerIndex, state.finishOrder, state.direction);
    return moveToNextTurn(
      state,
      state.players,
      state.finishOrder,
      starter,
      null,
      [],
      '全員パス！新しいラウンド',
      true,
      null,
      false,
      false,
    );
  }
  const nextIndex = findNextActivePlayer(state.players, state.currentPlayerIndex, state.finishOrder, state.direction);
  const handover = shouldHandover(state, state.players, nextIndex);
  return {
    ...state,
    passCount: nextPassCount,
    currentPlayerIndex: nextIndex,
    selectedCardIds: new Set(),
    phase: handover ? 'handover' : 'playing',
    handoverRevealed: handover ? false : true,
    message: `${current.name}がパス`,
  };
}

function cpuTurn(state: GameState): GameState {
  if (state.pendingEffect && state.players[state.currentPlayerIndex]?.isCPU) {
    const pending = state.pendingEffect;
    if (pending.type === 'seven') {
      const source = state.players[pending.sourcePlayerIndex];
      return resolveSeven(state, source.hand.slice(0, pending.count).map(card => card.id));
    }
    if (pending.type === 'ten') {
      const source = state.players[pending.sourcePlayerIndex];
      return resolveTen(state, source.hand.slice(0, pending.count).map(card => card.id));
    }
    const ranks = [...new Set(state.players.flatMap(player =>
      player.hand.map(card => card.isJoker ? 0 : card.rank)
    ))].slice(0, pending.count);
    return ranks.length === pending.count ? resolveQBombe(state, ranks) : completePendingEffect(state, state.players, state.finishOrder);
  }
  if (state.phase !== 'playing') return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current?.isCPU) return state;
  const play = chooseCPUPlay(
    current.hand,
    state.fieldCards,
    effectiveRevolution(state),
    state.suitShibari,
    current.hand.length,
    state.stairShibari,
  );
  return play ? applyPlay(state, play) : passTurn({
    ...state,
    // CPU pass follows the same turn rules without the human-only guard.
    players: state.players.map(player => ({ ...player })),
  }, true);
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const players = dealGame(
        buildPlayers(action.mode, action.playerCount, action.playerNames),
        false,
      );
      return {
        ...makeInitialState(),
        mode: action.mode,
        playerCount: action.playerCount,
        players,
        localPlayerIndex: action.localPlayerIndex ?? 0,
        currentPlayerIndex: findStartingPlayer(players),
        phase: 'playing',
        handoverRevealed: true,
      };
    }
    case 'TOGGLE_CARD': {
      if (state.phase !== 'playing' || state.pendingEffect) return state;
      const current = state.players[state.currentPlayerIndex];
      if (!current || current.isCPU) return state;
      const selected = new Set(state.selectedCardIds);
      if (selected.has(action.cardId)) selected.delete(action.cardId);
      else selected.add(action.cardId);
      return { ...state, selectedCardIds: selected };
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedCardIds: new Set() };
    case 'PLAY_CARDS': {
      const current = state.players[state.currentPlayerIndex];
      const played = current?.hand.filter(card => state.selectedCardIds.has(card.id)) ?? [];
      return applyPlay(state, played);
    }
    case 'PASS':
      return passTurn(state);
    case 'CPU_TAKE_TURN':
      return cpuTurn(state);
    case 'RESOLVE_PENDING_CARDS':
      return state.pendingEffect?.type === 'seven'
        ? resolveSeven(state, action.cardIds)
        : state.pendingEffect?.type === 'ten'
          ? resolveTen(state, action.cardIds)
          : state;
    case 'RESOLVE_Q_BOMBER':
      return resolveQBombe(state, action.ranks);
    case 'SKIP_PENDING':
      return state.pendingEffect?.type === 'seven' || state.pendingEffect?.type === 'ten'
        ? completePendingEffect(state, state.players, state.finishOrder, '効果をスキップしました')
        : state;
    case 'REMOTE_PLAY_CARDS': {
      if (state.mode !== 'online' || state.currentPlayerIndex !== action.playerIndex) return state;
      const played = state.players[action.playerIndex]?.hand.filter(card => action.cardIds.includes(card.id)) ?? [];
      return applyPlay(state, played);
    }
    case 'REMOTE_PASS':
      return state.mode === 'online' && state.currentPlayerIndex === action.playerIndex
        ? passTurn(state)
        : state;
    case 'REMOTE_RESOLVE_PENDING_CARDS':
      if (state.mode !== 'online' || state.currentPlayerIndex !== action.playerIndex) return state;
      return state.pendingEffect?.type === 'seven'
        ? resolveSeven(state, action.cardIds)
        : state.pendingEffect?.type === 'ten'
          ? resolveTen(state, action.cardIds)
          : state;
    case 'REMOTE_RESOLVE_Q_BOMBER':
      return state.mode === 'online' && state.currentPlayerIndex === action.playerIndex
        ? resolveQBombe(state, action.ranks)
        : state;
    case 'REMOTE_SKIP_PENDING':
      return state.mode === 'online' && state.currentPlayerIndex === action.playerIndex &&
        (state.pendingEffect?.type === 'seven' || state.pendingEffect?.type === 'ten')
        ? completePendingEffect(state, state.players, state.finishOrder, '効果をスキップしました')
        : state;
    case 'REPLACE_ONLINE_STATE':
      return state.mode === 'online'
        ? deserializeOnlineState(action.snapshot, state)
        : action.snapshot as unknown as GameState;
    case 'REVEAL_HAND':
      return { ...state, handoverRevealed: true };
    case 'CONFIRM_HANDOVER':
      return { ...state, phase: 'playing', handoverRevealed: false };
    case 'NEW_GAME': {
      const players = dealGame(buildPlayers(state.mode, state.playerCount), false);
      return {
        ...makeInitialState(),
        mode: state.mode,
        playerCount: state.playerCount,
        players,
        previousRoles: state.previousRoles,
        currentPlayerIndex: findStartingPlayer(players),
        phase: 'playing',
        localPlayerIndex: state.localPlayerIndex,
        handoverRevealed: true,
      };
    }
    case 'RESET_TO_MENU':
      return makeInitialState();
    default:
      return state;
  }
}

interface GameContextType {
  state: GameState;
  startGame: (mode: GameMode, playerCount: number, playerNames?: string[], localPlayerIndex?: number) => void;
  toggleCard: (cardId: string) => void;
  clearSelection: () => void;
  playCards: () => void;
  pass: () => void;
  cpuTakeTurn: () => void;
  resolvePendingCards: (cardIds: string[]) => void;
  resolveQBombe: (ranks: number[]) => void;
  skipPending: () => void;
  revealHand: () => void;
  confirmHandover: () => void;
  newGame: () => void;
  resetToMenu: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, makeInitialState());
  const online = useOnline();
  const processedActionRef = useRef(-1);

  const startGame = useCallback((
    mode: GameMode,
    playerCount: number,
    playerNames?: string[],
    localPlayerIndex = 0,
  ) => dispatch({
    type: 'START_GAME',
    mode,
    playerCount,
    playerNames,
    localPlayerIndex,
  }), []);
  const toggleCard = useCallback((cardId: string) => dispatch({ type: 'TOGGLE_CARD', cardId }), []);
  const clearSelection = useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), []);
  const playCards = useCallback(() => {
    if (state.mode === 'online' && !online.isHost) {
      online.sendAction({ type: 'play_cards', cardIds: [...state.selectedCardIds] });
      return;
    }
    dispatch({ type: 'PLAY_CARDS' });
  }, [online, state.mode, state.selectedCardIds]);
  const pass = useCallback(() => {
    if (state.mode === 'online' && !online.isHost) {
      online.sendAction({ type: 'pass' });
      return;
    }
    dispatch({ type: 'PASS' });
  }, [online, state.mode]);
  const cpuTakeTurn = useCallback(() => dispatch({ type: 'CPU_TAKE_TURN' }), []);
  const resolvePendingCards = useCallback((cardIds: string[]) => {
    if (state.mode === 'online' && !online.isHost) {
      online.sendAction({ type: 'resolve_pending_cards', cardIds });
      return;
    }
    dispatch({ type: 'RESOLVE_PENDING_CARDS', cardIds });
  }, [online, state.mode]);
  const resolveQBombe = useCallback((ranks: number[]) => {
    if (state.mode === 'online' && !online.isHost) {
      online.sendAction({ type: 'resolve_q_bomber', ranks });
      return;
    }
    dispatch({ type: 'RESOLVE_Q_BOMBER', ranks });
  }, [online, state.mode]);
  const skipPending = useCallback(() => {
    if (state.mode === 'online' && !online.isHost) {
      online.sendAction({ type: 'skip_pending' });
      return;
    }
    dispatch({ type: 'SKIP_PENDING' });
  }, [online, state.mode]);
  const revealHand = useCallback(() => dispatch({ type: 'REVEAL_HAND' }), []);
  const confirmHandover = useCallback(() => dispatch({ type: 'CONFIRM_HANDOVER' }), []);
  const newGame = useCallback(() => dispatch({ type: 'NEW_GAME' }), []);
  const resetToMenu = useCallback(() => {
    online.leaveRoom();
    dispatch({ type: 'RESET_TO_MENU' });
  }, [online]);

  useEffect(() => {
    if (state.mode !== 'online' || !online.isHost || online.room?.status !== 'playing') return;
    for (const player of online.room.players) {
      online.sendGameSnapshot(player.playerId, serializeStateForPlayer(state, player.slot));
    }
  }, [online, state]);

  useEffect(() => {
    if (state.mode !== 'online' || online.isHost || !online.gameSnapshot) return;
    dispatch({
      type: 'REPLACE_ONLINE_STATE',
      snapshot: online.gameSnapshot as SerializedGameState,
    });
  }, [online.gameSnapshot, online.isHost, state.mode]);

  useEffect(() => {
    const incoming = online.incomingAction;
    if (!incoming || incoming.nonce === processedActionRef.current || !online.isHost) return;
    processedActionRef.current = incoming.nonce;
    switch (incoming.action.type) {
      case 'play_cards':
        dispatch({ type: 'REMOTE_PLAY_CARDS', playerIndex: incoming.playerIndex, cardIds: incoming.action.cardIds });
        break;
      case 'pass':
        dispatch({ type: 'REMOTE_PASS', playerIndex: incoming.playerIndex });
        break;
      case 'resolve_pending_cards':
        dispatch({ type: 'REMOTE_RESOLVE_PENDING_CARDS', playerIndex: incoming.playerIndex, cardIds: incoming.action.cardIds });
        break;
      case 'resolve_q_bomber':
        dispatch({ type: 'REMOTE_RESOLVE_Q_BOMBER', playerIndex: incoming.playerIndex, ranks: incoming.action.ranks });
        break;
      case 'skip_pending':
        dispatch({ type: 'REMOTE_SKIP_PENDING', playerIndex: incoming.playerIndex });
        break;
    }
  }, [online.incomingAction, online.isHost]);

  return (
    <GameContext.Provider value={{
      state, startGame, toggleCard, clearSelection, playCards, pass, cpuTakeTurn,
      resolvePendingCards, resolveQBombe, skipPending, revealHand, confirmHandover,
      newGame, resetToMenu,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
}