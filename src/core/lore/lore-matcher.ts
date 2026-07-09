// Lore Matcher — lexical matching engine.
// Matches query keywords against lore entry keys (primary + secondary).
// Pure function; no I/O, no storage, no LLM.

import type { LoreEntry, LoreMatch } from './lore-types';

/**
 * Normalize text for matching: lowercase, trim.
 * Used for both keys and query keywords.
 */
export const normalizeText = (text: string): string => text.toLowerCase().trim();

/**
 * Check if a text contains another as a whole word (case-insensitive).
 * "hello world" contains "hello" and "world" as words, but not "ell" or "wor".
 * Words are delimited by whitespace or non-alphanumeric characters.
 */
export const containsWholeWord = (haystack: string, needle: string): boolean => {
  const normalized = normalizeText(haystack);
  const needleNorm = normalizeText(needle);
  if (normalized === needleNorm) return true;
  const wordBoundary = /\b/g;
  return wordBoundary.test(`${normalized}`) && new RegExp(`\\b${needleNorm}\\b`).test(normalized);
};

/**
 * LoreMatcher — matches query keywords against lore entry keys.
 * Pure: takes data in, returns matches out.
 */
export class LoreMatcher {
  /**
   * Match a single entry against query keywords.
   * Returns all matches (both primary and secondary key matches).
   */
  public static matchEntry(entry: LoreEntry, queryKeywords: string[]): LoreMatch[] {
    const matches: LoreMatch[] = [];

    // Constant entries always match (no key needed).
    if (entry.constant) {
      matches.push({
        entry,
        matchedKeyType: null,
        matchedKey: undefined,
        score: 1.0,
      });
      return matches;
    }

    // Primary keys (higher priority).
    for (const key of entry.keys) {
      for (const query of queryKeywords) {
        if (containsWholeWord(query, key)) {
          matches.push({
            entry,
            matchedKeyType: 'primary',
            matchedKey: key,
            score: 1.0,
          });
          return matches; // One primary match is enough; stop looking.
        }
      }
    }

    // Secondary keys (lower priority, only if no primary match).
    if (entry.secondaryKeys && entry.secondaryKeys.length > 0) {
      for (const key of entry.secondaryKeys) {
        for (const query of queryKeywords) {
          if (containsWholeWord(query, key)) {
            matches.push({
              entry,
              matchedKeyType: 'secondary',
              matchedKey: key,
              score: 0.7,
            });
            return matches; // One secondary match is enough; stop looking.
          }
        }
      }
    }

    return matches;
  }

  /**
   * Match all entries against query keywords.
   * Returns a flat list of all matches, preserving duplicates (one per key match).
   */
  public static matchEntries(entries: LoreEntry[], queryKeywords: string[]): LoreMatch[] {
    const allMatches: LoreMatch[] = [];
    for (const entry of entries) {
      const matches = this.matchEntry(entry, queryKeywords);
      allMatches.push(...matches);
    }
    return allMatches;
  }
}
