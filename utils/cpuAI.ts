// ============================================================
// 大富豪 CPU AI
// ============================================================

import {
  Card,
  Suit,
  getPlayType,
  isValidPlay,
  getHandValue,
  sortHand,
} from './gameEngine';

// Generate all valid single/pair/triple combinations from hand
function getCombinations(hand: Card[], size: number): Card[][] {
  if (size === 0) return [[]];
  if (hand.length < size) return [];
  const result: Card[][] = [];
  for (let i = 0; i <= hand.length - size; i++) {
    const rest = getCombinations(hand.slice(i + 1), size - 1);
    for (const combo of rest) {
      result.push([hand[i], ...combo]);
    }
  }
  return result;
}

// Find all valid plays for the CPU
export function findValidPlays(
  hand: Card[],
  fieldCards: Card[] | null,
  revolution: boolean,
  suitShibari: Suit | null,
  stairShibari: boolean = false
): Card[][] {
  const valid: Card[][] = [];
  const fieldLen = fieldCards ? fieldCards.length : 0;

  // Determine what sizes to try
  const sizes = fieldLen > 0 ? [fieldLen] : [1, 2, 3, 4, 5, 6, 7, 8];

  for (const size of sizes) {
    if (size > hand.length) continue;
    const combos = getCombinations(hand, size);
    for (const combo of combos) {
      const type = getPlayType(combo);
      if (type === 'invalid') continue;
      if (isValidPlay(combo, fieldCards, revolution, suitShibari, stairShibari)) {
        valid.push(combo);
      }
    }
  }

  return valid;
}

// CPU strategy: play weakest valid hand; play strongest when ≤3 cards remain
export function chooseCPUPlay(
  hand: Card[],
  fieldCards: Card[] | null,
  revolution: boolean,
  suitShibari: Suit | null,
  handCount: number,
  stairShibari: boolean = false
): Card[] | null {
  const validPlays = findValidPlays(hand, fieldCards, revolution, suitShibari, stairShibari);
  if (validPlays.length === 0) return null;

  // Sort valid plays by value (weakest first)
  const sorted = validPlays.sort((a, b) => {
    const va = getHandValue(a, revolution);
    const vb = getHandValue(b, revolution);
    return va - vb;
  });

  // If CPU has few cards left, play most aggressively
  if (handCount <= 3) {
    return sorted[sorted.length - 1]; // play strongest
  }

  // Standard: play weakest valid hand, avoiding joker if possible
  const withoutJoker = sorted.filter(play => !play.some(c => c.isJoker));
  if (withoutJoker.length > 0) return withoutJoker[0];

  return sorted[0];
}

// Sort hand by value for display
export function getSortedHandForCPU(hand: Card[], revolution: boolean): Card[] {
  return sortHand(hand, revolution);
}
