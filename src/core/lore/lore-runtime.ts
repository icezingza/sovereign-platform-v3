// Lore Runtime — generic lore retrieval engine.
// Orchestrates: collect → filter → match → rank → return.
// Pure domain engine; no I/O, no LLM, no storage.
// Runtime guards reject untrusted data (activationScript, extensions, unknown executable fields).

import type { LoreEntry, LoreRetrievalInput, LoreRetrievalConfig, LoreMatchResult, LoreMatch } from './lore-types';
import { LoreMatcher } from './lore-matcher';
import { LoreRanker } from './lore-ranker';

/**
 * Runtime guard: check if an entry contains untrusted/executable fields.
 * Rejects: activationScript, extensions, and unknown fields that look like executable code.
 * Throws DomainError if validation fails.
 */
const validateLoreEntry = (entry: LoreEntry): void => {
  // Reject activationScript.
  if ((entry as unknown as Record<string, unknown>).activationScript !== undefined) {
    throw new Error(`Untrusted field in lore entry ${entry.id}: activationScript not allowed`);
  }

  // Reject extensions.
  if ((entry as unknown as Record<string, unknown>).extensions !== undefined) {
    throw new Error(`Untrusted field in lore entry ${entry.id}: extensions not allowed`);
  }

  // Check for unknown fields that might be executable.
  const knownKeys = new Set([
    'id',
    'scope',
    'keys',
    'secondaryKeys',
    'content',
    'priority',
    'insertionOrder',
    'probability',
    'enabled',
    'constant',
    'minMessages',
    'cooldown',
    'lastMatchedAt',
    'relationshipConditions',
    'memoryConditions',
    'metadata',
  ]);

  const entryObj = entry as unknown as Record<string, unknown>;
  for (const key of Object.keys(entryObj)) {
    if (!knownKeys.has(key)) {
      // Flag as suspicious if it looks like a code-related field or handler.
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('script') ||
        lowerKey.includes('execute') ||
        lowerKey.includes('eval') ||
        lowerKey.includes('function') ||
        lowerKey.includes('callback') ||
        lowerKey.includes('handler') ||
        lowerKey.startsWith('on') || // event listeners: onClick, onMatch, onLoad, etc.
        lowerKey.includes('match') || // match-related handlers
        lowerKey.includes('transform') || // data transformation functions
        lowerKey.includes('manipulate') // data manipulation functions
      ) {
        throw new Error(
          `Untrusted field in lore entry ${entry.id}: ${key} not recognized (possible executable)`
        );
      }
    }
  }
};

/**
 * LoreRuntime — generic lore retrieval engine.
 * Pure: takes data in, returns matched lore out.
 * Stateless: no session state, no cache, no side effects.
 */
export class LoreRuntime {
  /**
   * Retrieve and rank lore entries based on query keywords.
   *
   * Pipeline:
   * 1. collect: filter by enabled, scope, cooldown, minMessages
   * 2. match: apply lexical matching (primary + secondary keys)
   * 3. rank: deterministic sort (constant → priority → insertionOrder → matchType → probability)
   * 4. return: capped by maxLore
   *
   * Throws: if any entry fails runtime validation.
   */
  public static retrieveLore(input: LoreRetrievalInput): LoreMatchResult {
    const { entries, queryKeywords, config, now = Date.now() } = input;

    // ── collect: filter entries ──
    const collected = this.collectEntries(entries, config, now);

    // ── match: find keyword matches ──
    const matched = LoreMatcher.matchEntries(collected, queryKeywords);

    // ── rank: deterministic sort ──
    const ranked = LoreRanker.rankMatches(matched);

    // ── return: cap by maxLore ──
    const maxLore = config.maxLore ?? 6;
    const selected = ranked.slice(0, maxLore);

    return {
      matches: selected,
      estimatedTokens: LoreRanker.estimateTotalTokens(selected),
    };
  }

  /**
   * Collect eligible entries based on retrieval config.
   * Filters by: enabled, scope, minMessages, cooldown, runtime guards.
   *
   * Throws: if any entry fails runtime validation.
   */
  private static collectEntries(
    entries: LoreEntry[],
    config: LoreRetrievalConfig,
    now: number
  ): LoreEntry[] {
    const collected: LoreEntry[] = [];

    for (const entry of entries) {
      // Runtime guard: validate entry structure.
      validateLoreEntry(entry);

      // Filter: disabled entries.
      if (!entry.enabled) continue;

      // Filter: scope (skip 'character' scope unless activeCharacterId matches, or no character is active).
      if (entry.scope === 'character' && config.activeCharacterId === undefined) {
        continue;
      }

      // Filter: minMessages (lore only eligible after N messages).
      const currentMsgCount = config.currentMessageCount ?? 0;
      const minMsgThreshold = entry.minMessages ?? 0;
      if (currentMsgCount < minMsgThreshold) {
        continue;
      }

      // Filter: cooldown (skip if recently matched).
      if (entry.cooldown !== undefined && entry.lastMatchedAt !== undefined) {
        const timeSinceLastMatch = now - entry.lastMatchedAt;
        if (timeSinceLastMatch < entry.cooldown) {
          continue;
        }
      }

      collected.push(entry);
    }

    return collected;
  }
}
