// Lore Types — schema for lore entries and retrieval results.
// Pure data structures; no I/O, no LLM, no storage dependencies.

/** Scope controls lore visibility: 'world' applies always, 'character' only when that character is active. */
export type LoreScope = 'world' | 'character';

/** LoreEntry — a single lore item with lifecycle, matching keys, and ranking metadata. */
export interface LoreEntry {
  /** Unique identifier, e.g. uuid. */
  id: string;

  /** Visibility scope: 'world' (always active) or 'character' (character-specific). */
  scope: LoreScope;

  /** Primary keywords for lexical matching (case-insensitive, whole-word). */
  keys: string[];

  /** Secondary keywords (optional, lower-rank matches). */
  secondaryKeys?: string[];

  /** Lore content text, injected into context when matched. */
  content: string;

  /** Priority rank (higher = prefer first; used in deterministic sort). */
  priority: number;

  /** Insertion order (timestamp or sequence, for deterministic tiebreaking). */
  insertionOrder: number;

  /** Probability (0..1, likelihood of inclusion; used in ranking). */
  probability: number;

  /** Enable/disable toggle (false = never matched). */
  enabled: boolean;

  /** Constant marker (if true, always included when scope matches, no budget constraints). */
  constant: boolean;

  /** Min messages in chat before this entry is eligible (cooldown / late-game activation). */
  minMessages?: number;

  /** Cooldown in milliseconds after last match (prevents spam). */
  cooldown?: number;

  /** Last timestamp this entry was matched/injected (for cooldown tracking). */
  lastMatchedAt?: number;

  /** Optional: condition requiring specific relationship stage + attachment style. */
  relationshipConditions?: {
    stageName?: string;
    attachmentStyle?: string;
  };

  /** Optional: condition requiring specific memory to exist in active memories. */
  memoryConditions?: {
    /** Lexical substring search in active memory content. */
    memoryKeywords?: string[];
    /** Require at least N active memories for this lore to match. */
    minActiveCount?: number;
  };

  /** Metadata for future extensions (tags, source, etc.). */
  metadata?: Record<string, unknown>;
}

/** Result of a single lore match (before ranking). */
export interface LoreMatch {
  entry: LoreEntry;
  /** Which key matched: 'primary', 'secondary', or null if constant (no key match needed). */
  matchedKeyType?: 'primary' | 'secondary' | null;
  /** The matched key text (undefined if constant). */
  matchedKey?: string;
  /** Score contribution from this match (for deterministic ranking). */
  score: number;
}

/** Final lore retrieval result after ranking and selection. */
export interface LoreMatchResult {
  /** Matched lore entries, ranked in final order. */
  matches: LoreMatch[];
  /** Total token cost estimate (all matched entries). */
  estimatedTokens: number;
}

/** Configuration for lore retrieval pipeline. */
export interface LoreRetrievalConfig {
  /** Max lore entries to return (default 6). */
  maxLore?: number;
  /** Min message count before lore is eligible (default 0). */
  minMessages?: number;
  /** Current message count (for minMessages filtering). */
  currentMessageCount?: number;
  /** Character ID (for scope='character' filtering). */
  activeCharacterId?: string;
  /** Current message text (for keyword matching). */
  messageText?: string;
  /** Current memory query vector (unused in Phase 4B Sprint 1). */
  queryEmbedding?: number[];
}

/** Input to the lore retrieval pipeline. */
export interface LoreRetrievalInput {
  /** All available lore entries. */
  entries: LoreEntry[];
  /** Query keywords (from current message or context). */
  queryKeywords: string[];
  /** Retrieval configuration. */
  config: LoreRetrievalConfig;
  /** Current timestamp (for cooldown calculation). */
  now?: number;
}
