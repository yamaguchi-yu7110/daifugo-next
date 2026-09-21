// ============================================================
// 大富豪 ゲームエンジン
// ============================================================

export type Suit = 'spade' | 'heart' | 'diamond' | 'club';
export type PlayType = 'single' | 'pair' | 'triple' | 'quad' | 'staircase' | 'invalid';

export interface Card {
  id: string;
  rank: number; // 1=A, 2-10, 11=J, 12=Q, 13=K, 0=Joker
  suit: Suit | 'joker';
  isJoker: boolean;
}

export type Role = '大富豪' | '富豪' | '平民' | '貧民' | '大貧民';

export const ROLES: Role[] = ['大富豪', '富豪', '平民', '貧民', '大貧民'];

export const SUIT_SYMBOLS: Record<Suit | 'joker', string> = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
  joker: '★',
};

export const RANK_LABELS: Record<number, string> = {
  0: 'JK',
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

// Normal order: 3 < 4 < ... < K < A < 2 < Joker
// Revolution: flipped (3 is highest, 2 is lowest), Joker still highest
export function cardValue(card: Card, revolution: boolean): number {
  if (card.isJoker) return 100; // Joker always highest
  let v: number;
  if (card.rank === 2) v = 15;
  else if (card.rank === 1) v = 14; // Ace
  else v = card.rank; // 3-13
  if (revolution) {
    return 18 - v; // 3→15, 4→14, ..., A→4, 2→3
  }
  return v;
}

// Create a 53-card deck (52 standard + 1 joker)
export function createDeck(): Card[] {
  const suits: Suit[] = ['spade', 'heart', 'diamond', 'club'];
  const cards: Card[] = [];
  let id = 0;
  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank++) {
      cards.push({ id: `${id++}`, rank, suit, isJoker: false });
    }
  }
  cards.push({ id: `${id++}`, rank: 0, suit: 'joker', isJoker: true });
  return cards;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function dealCards(deck: Card[], playerCount: number): Card[][] {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  deck.forEach((card, i) => {
    hands[i % playerCount].push(card);
  });
  return hands;
}

// Sort hand: by value ascending (normal order by default), same value by suit
export function sortHand(hand: Card[], revolution: boolean): Card[] {
  return [...hand].sort((a, b) => {
    const av = cardValue(a, revolution);
    const bv = cardValue(b, revolution);
    if (av !== bv) return av - bv;
    const suitOrder: Record<string, number> = { spade: 0, heart: 1, diamond: 2, club: 3, joker: 4 };
    return (suitOrder[a.suit] ?? 4) - (suitOrder[b.suit] ?? 4);
  });
}

// Determine the type of a hand
export function getPlayType(cards: Card[]): PlayType {
  if (cards.length === 0) return 'invalid';
  const jokers = cards.filter(c => c.isJoker);
  const normals = cards.filter(c => !c.isJoker);

  if (cards.length === 1) return 'single';

  // 同数セット。ジョーカーは1枚まで同数の代用として扱う。
  // 4枚以上の同数セットは革命を起こすため、5枚もここで受ける。
  if (isSameRankSet(cards)) {
    if (cards.length === 2) return 'pair';
    if (cards.length === 3) return 'triple';
    return 'quad';
  }

  // 階段セットは3枚以上かつ同一スートのみ。
  if (isStaircaseHand(cards)) return 'staircase';
  return 'invalid';
}

export function isSameRankSet(cards: Card[]): boolean {
  if (cards.length < 2 || cards.length > 5) return false;
  const normals = cards.filter(c => !c.isJoker);
  const jokers = cards.filter(c => c.isJoker);
  return jokers.length <= 1 && normals.length > 0 && normals.every(c => c.rank === normals[0].rank);
}

function isStaircaseHand(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  const jokers = cards.filter(c => c.isJoker);
  const normals = cards.filter(c => !c.isJoker);

  if (jokers.length > 1) return false;

  // All non-joker must be same suit (階段セット requires same suit)
  const suits = new Set(normals.map(c => c.suit));
  if (suits.size > 1) return false;

  // Sort by rank using staircase ordering
  const getStaircaseValue = (r: number) => {
    if (r === 1) return 14; // A
    if (r === 2) return 15; // 2
    return r;
  };

  const sorted = [...normals].sort((a, b) => getStaircaseValue(a.rank) - getStaircaseValue(b.rank));
  let jokerUsed = jokers.length === 0;

  for (let i = 1; i < sorted.length; i++) {
    const diff = getStaircaseValue(sorted[i].rank) - getStaircaseValue(sorted[i - 1].rank);
    if (diff === 1) continue;
    if (diff === 2 && !jokerUsed) {
      jokerUsed = true;
      continue;
    }
    return false;
  }
  // Joker can extend either end if not used for a gap
  return true;
}

// Get the comparative value of a played hand (higher = stronger)
// For 同数セット (pair/triple/quad): value = rank of the repeated card
// For 階段セット (staircase): value = LOWEST (weakest) card — rule: 出すセットの最も弱いカードが強ければ出せる
export function getHandValue(cards: Card[], revolution: boolean): number {
  const type = getPlayType(cards);
  if (type === 'invalid') return -1;

  const jokers = cards.filter(c => c.isJoker);
  const normals = cards.filter(c => !c.isJoker);

  if (type === 'single') {
    return cardValue(cards[0], revolution);
  }

  if (type === 'pair' || type === 'triple' || type === 'quad') {
    // Value from non-joker card rank
    if (normals.length === 0) return 100;
    return cardValue(normals[0], revolution);
  }

  if (type === 'staircase') {
    // 階段セットは最も弱いカード（下端）で比較する
    // Joker placed at top (optimal), so min is always the lowest normal card
    if (normals.length === 0) return 100;
    const vals = normals.map(c => cardValue(c, revolution));
    return Math.min(...vals);
  }

  return -1;
}

// Get the suit if all non-joker cards in the hand are the same suit, else null
export function getHandSuit(cards: Card[]): Suit | null {
  const normals = cards.filter(c => !c.isJoker);
  if (normals.length === 0) return null;
  const suits = new Set(normals.map(c => c.suit));
  if (suits.size === 1) return normals[0].suit as Suit;
  return null;
}

// Check if a play is valid given the current field state
// suitShibari: if set, all non-joker cards must match this suit
// stairShibari: if true, played value must be exactly field value + 1 (consecutive)
export function isValidPlay(
  played: Card[],
  fieldCards: Card[] | null,
  revolution: boolean,
  suitShibari: Suit | null,
  stairShibari: boolean = false
): boolean {
  const playType = getPlayType(played);
  if (playType === 'invalid') return false;

  // Check suit shibari constraint (スート縛り)
  if (suitShibari) {
    const normals = played.filter(c => !c.isJoker);
    if (playType === 'staircase') {
      if (!normals.every(c => c.suit === suitShibari)) return false;
    } else {
      // 片縛りあり: 同数セットでは、1枚でも縛りスートを含めば有効。
      // ペアは同じスートを2枚持てないため、全枚一致を要求すると
      // セット出しのスート縛りが成立しなくなる。
      if (!normals.some(c => c.suit === suitShibari)) return false;
    }
  }

  // Special: スペ3返し - 3 of spades beats Joker single
  if (fieldCards && fieldCards.length === 1 && fieldCards[0].isJoker) {
    if (played.length === 1 && played[0].rank === 3 && played[0].suit === 'spade') {
      return true;
    }
    return false; // Joker single can't be beaten otherwise
  }

  if (!fieldCards || fieldCards.length === 0) {
    // Fresh round - any valid hand is OK
    return true;
  }

  // Must match count
  if (played.length !== fieldCards.length) return false;

  const fieldType = getPlayType(fieldCards);

  // 同数セットには同数セット、階段セットには階段セットでしか対応できない
  if (playType === 'staircase' && fieldType !== 'staircase') return false;
  if (playType !== 'staircase' && fieldType === 'staircase') return false;
  // 階段セットは同じ枚数の階段セットでのみ返せる。
  if (playType === 'staircase' && played.length !== fieldCards.length) return false;

  const playedVal = getHandValue(played, revolution);
  const fieldVal = getHandValue(fieldCards, revolution);

  // 階段縛り: must be exactly consecutive (value + 1)
  if (stairShibari) {
    return playedVal === fieldVal + 1;
  }

  // Normal comparison: played must be strictly stronger than field
  return playedVal > fieldVal;
}

// Check what special effects a play triggers
export interface PlayEffects {
  isEightCut: boolean;
  isRevolution: boolean;
  fiveSkipCount: number;
  sevenPassCount: number;
  isNineReverse: boolean;
  tenDiscardCount: number;
  isJBack: boolean;
  qBomberCount: number;
  newSuitShibari: Suit | null;   // スート縛り (片縛りあり)
  newStairShibari: boolean;       // 階段縛り
}

export function checkPlayEffects(
  played: Card[],
  prevFieldCards: Card[] | null,
  currentSuitShibari: Suit | null,
  currentStairShibari: boolean,
  currentRevolution: boolean
): PlayEffects {
  const normals = played.filter(c => !c.isJoker);

  // 8切り: any play that includes an 8
  const isEightCut = normals.some(c => c.rank === 8);

  // 革命: 4枚以上の同数セット
  const playType = getPlayType(played);
  const isRevolution = playType === 'quad';
  const fiveSkipCount = normals.filter(c => c.rank === 5).length;
  const sevenPassCount = normals.filter(c => c.rank === 7).length;
  const nineCount = normals.filter(c => c.rank === 9).length;
  const tenDiscardCount = normals.filter(c => c.rank === 10).length;
  const isNineReverse = nineCount % 2 === 1;
  const isJBack = normals.some(c => c.rank === 11);
  const qBomberCount = normals.filter(c => c.rank === 12).length;

  let newSuitShibari: Suit | null = null;
  let newStairShibari = false;

  if (!isEightCut && !isRevolution) {
    // ── スート縛り（片縛りあり）──────────────────────────────────────────
    // 場のカード（ジョーカー除く）に含まれるスートをすべて収集する。
    // 出したカードのどれか1枚でも場のいずれかのスートと一致→そのスートで縛り発動。
    // ※ getHandSuit は全枚同スートのときだけ返すため、混合スートのセットに使えない。
    //   ここでは個別に照合する（片縛りあり）。
    if (!currentSuitShibari) {
      const fieldSuits = new Set(
        (prevFieldCards ?? []).filter(c => !c.isJoker).map(c => c.suit)
      );
      // 出した札を順に見て最初に場のスートと一致したものを縛りスートとする
      const matched = normals.find(c => fieldSuits.has(c.suit));
      if (matched) {
        newSuitShibari = matched.suit as Suit;
      }
    } else {
      // 既存の縛りを維持（このラウンドが終わるまで）
      newSuitShibari = currentSuitShibari;
    }

    // ── 階段縛り ──────────────────────────────────────────────────────────
    // 出したカードの強さが場のカードの強さ+1ちょうどなら階段縛り発動
    // 既に階段縛りが発動中なら維持
    if (prevFieldCards && prevFieldCards.length > 0) {
      const playedVal = getHandValue(played, currentRevolution);
      const fieldVal = getHandValue(prevFieldCards, currentRevolution);
      if (playedVal === fieldVal + 1) {
        newStairShibari = true;
      } else if (currentStairShibari) {
        // Was already active but play wasn't consecutive — shouldn't happen if isValidPlay checked
        // but keep it consistent: stairShibari stays on as long as someone plays consecutively
        newStairShibari = currentStairShibari;
      }
    }
  }
  // 8切り or 革命 → 縛りリセット（newSuitShibari=null, newStairShibari=false）

  return {
    isEightCut,
    isRevolution,
    fiveSkipCount,
    sevenPassCount,
    isNineReverse,
    tenDiscardCount,
    isJBack,
    qBomberCount,
    newSuitShibari,
    newStairShibari,
  };
}

// 禁止上がり。Jバック中も、現在の強さ（革命 XOR Jバック）を基準にする。
export function isForbiddenFinish(cards: Card[], effectiveRevolution: boolean): boolean {
  if (cards.some(c => c.isJoker || c.rank === 8)) return true;
  return cards.some(c => !effectiveRevolution && c.rank === 2)
    || cards.some(c => effectiveRevolution && c.rank === 3);
}

// Role assignment based on finish order
export function assignRoles(
  finishOrder: number[],
  playerCount: number
): Record<number, Role> {
  const roleMap: Record<number, Role> = {};
  const roleNames = getRolesForCount(playerCount);
  finishOrder.forEach((playerIdx, rank) => {
    roleMap[playerIdx] = roleNames[rank] ?? '平民';
  });
  return roleMap;
}

function getRolesForCount(count: number): Role[] {
  if (count === 2) return ['大富豪', '大貧民'];
  if (count === 3) return ['大富豪', '平民', '大貧民'];
  if (count === 4) return ['大富豪', '富豪', '貧民', '大貧民'];
  return ['大富豪', '富豪', '平民', '平民', '貧民', '大貧民'].slice(0, count) as Role[];
}

// (カード交換ルールなし — 以下の関数はレガシーとして残す)
export interface ExchangeInfo {
  from: number;
  to: number;
  count: number;
}

export function getRoleExchanges(
  _roles: Record<number, Role>,
  _playerCount: number
): ExchangeInfo[] {
  return []; // カード交換なし
}

export function getBestCards(hand: Card[], count: number, revolution: boolean): Card[] {
  return sortHand(hand, revolution).slice(-count);
}

export function getWorstCards(hand: Card[], count: number, revolution: boolean): Card[] {
  return sortHand(hand, revolution).slice(0, count);
}
