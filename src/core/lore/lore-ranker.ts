// Lore Ranker — deterministic ranking of lore matches.
// Ranks by: constant → priority → insertionOrder → key match type → probability.
// Pure function; no I/O, no storage, no randomness.

import type { LoreMatch } from './lore-types';

/**
 * Ranking key for deterministic sort.
 * Lower values rank higher (come first).
 * Ranking order: isConstant → matchType → priority → insertionOrder → probability
 * (constant entries rank first, then non-constant by match type and priority)
 */
interface RankingKey {
  isConstant: number; // 0 if constant, 1 if not (constant entries rank first)
  matchType: number; // 0 for primary, 1 for secondary, 2 for no-match
  priority: number; // negated so higher priority values rank first
  insertionOrder: number; // lower insertion order ranks first
  probability: number; // negated so higher probability ranks first
}

/**
 * Derive a deterministic ranking key from a LoreMatch.
 */
const deriveRankingKey = (match: LoreMatch): RankingKey => {
  const isConstant = match.entry.constant ? 0 : 1; // constant entries rank first
  const priority = -match.entry.priority; // negate so higher priority ranks first
  const insertionOrder = match.entry.insertionOrder;
  let matchType = 2; // default: no key match
  if (match.matchedKeyType === 'primary') {
    matchType = 0;
  } else if (match.matchedKeyType === 'secondary') {
    matchType = 1;
  }
  const probability = -match.entry.probability; // negate so higher probability ranks first

  return {
    isConstant,
    matchType,
    priority,
    insertionOrder,
    probability,
  };
};

/**
 * Compare two ranking keys for sort order.
 * Returns: < 0 if a ranks higher, > 0 if b ranks higher, 0 if tied.
 */
const compareRankingKeys = (a: RankingKey, b: RankingKey): number => {
  if (a.isConstant !== b.isConstant) return a.isConstant - b.isConstant;
  if (a.matchType !== b.matchType) return a.matchType - b.matchType;
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (a.insertionOrder !== b.insertionOrder) return a.insertionOrder - b.insertionOrder;
  return a.probability - b.probability;
};

/**
 * LoreRanker — deterministic ranking of lore matches.
 * Pure: takes matches in, returns ranked matches out.
 */
export class LoreRanker {
  /**
   * Rank lore matches deterministically.
   * Does NOT mutate the input array.
   * Returns a new array sorted by: constant → priority → insertionOrder → matchType → probability.
   */
  public static rankMatches(matches: LoreMatch[]): LoreMatch[] {
    // Create a copy so we don't mutate the input.
    const copy = [...matches];

    // Sort by derived ranking keys.
    copy.sort((a, b) => {
      const keyA = deriveRankingKey(a);
      const keyB = deriveRankingKey(b);
      return compareRankingKeys(keyA, keyB);
    });

    return copy;
  }

  /**
   * Estimate token cost for a single lore entry.
   * Simple heuristic: ~1 token per 4 characters (matching Token_Budget.ts convention).
   */
  public static estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  /**
   * Estimate total token cost for a list of matches.
   */
  public static estimateTotalTokens(matches: LoreMatch[]): number {
    return matches.reduce((sum, match) => sum + this.estimateTokens(match.entry.content), 0);
  }
}
