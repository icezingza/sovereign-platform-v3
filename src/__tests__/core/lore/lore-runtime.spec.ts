// Lore Runtime Tests — Phase 4B Sprint 1 regression suite.
// Covers: lexical matching, ranking, constant, disabled, cooldown, minMessages, guards.

import { LoreRuntime } from '../../../core/lore/lore-runtime';
import type { LoreEntry, LoreRetrievalInput, LoreRetrievalConfig } from '../../../core/lore/lore-types';

const baseEntry = (overrides: Partial<LoreEntry> = {}): LoreEntry => ({
  id: 'test-entry',
  scope: 'world',
  keys: ['magic', 'spell'],
  content: 'A spell is cast.',
  priority: 1,
  insertionOrder: 0,
  probability: 1.0,
  enabled: true,
  constant: false,
  ...overrides,
});

const baseConfig = (overrides: Partial<LoreRetrievalConfig> = {}): LoreRetrievalConfig => ({
  maxLore: 6,
  minMessages: 0,
  currentMessageCount: 10,
  ...overrides,
});

describe('LoreRuntime — Lexical Matching', () => {
  it('matches primary keys with case-insensitive whole-word search', () => {
    const entry = baseEntry({ keys: ['magic', 'spell'] });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['MAGIC'], // uppercase
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedKeyType).toBe('primary');
    expect(result.matches[0].matchedKey).toBe('magic');
  });

  it('does not match partial words', () => {
    const entry = baseEntry({ keys: ['magic'] });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['mag'], // partial
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(0);
  });

  it('matches whole words in compound phrases', () => {
    const entry = baseEntry({ keys: ['crystal', 'orb'] });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['The crystal orb glows brightly'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedKey).toBe('crystal');
  });
});

describe('LoreRuntime — Secondary Keys', () => {
  it('matches secondary keys only if no primary key matches', () => {
    const entry = baseEntry({
      keys: ['primary'],
      secondaryKeys: ['secondary'],
    });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['secondary'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedKeyType).toBe('secondary');
  });

  it('prefers primary key match over secondary', () => {
    const entry = baseEntry({
      keys: ['primary'],
      secondaryKeys: ['secondary'],
    });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['primary secondary'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedKeyType).toBe('primary');
  });
});

describe('LoreRuntime — Deterministic Ranking', () => {
  it('ranks constant entries first', () => {
    const constant = baseEntry({ id: 'const', constant: true, priority: 0 });
    const regular = baseEntry({ id: 'reg', constant: false, priority: 10 });
    const input: LoreRetrievalInput = {
      entries: [regular, constant],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches[0].entry.id).toBe('const');
  });

  it('ranks by priority (higher priority first)', () => {
    const high = baseEntry({ id: 'high', priority: 10, insertionOrder: 1 });
    const low = baseEntry({ id: 'low', priority: 1, insertionOrder: 0 });
    const input: LoreRetrievalInput = {
      entries: [low, high],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches[0].entry.id).toBe('high');
  });

  it('ranks by insertionOrder on priority tie', () => {
    const first = baseEntry({ id: 'first', priority: 5, insertionOrder: 0 });
    const second = baseEntry({ id: 'second', priority: 5, insertionOrder: 1 });
    const input: LoreRetrievalInput = {
      entries: [second, first],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches[0].entry.id).toBe('first');
  });

  it('ranks primary key matches over secondary on priority tie', () => {
    const primary = baseEntry({
      id: 'prim',
      keys: ['primary'],
      priority: 5,
      insertionOrder: 0,
    });
    const secondary = baseEntry({
      id: 'sec',
      keys: ['other'],
      secondaryKeys: ['primary'],
      priority: 5,
      insertionOrder: 0,
    });
    const input: LoreRetrievalInput = {
      entries: [secondary, primary],
      queryKeywords: ['primary'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches[0].entry.id).toBe('prim');
  });

  it('ranks by probability on full tie', () => {
    const highProb = baseEntry({
      id: 'high',
      priority: 5,
      insertionOrder: 0,
      probability: 0.9,
    });
    const lowProb = baseEntry({
      id: 'low',
      priority: 5,
      insertionOrder: 0,
      probability: 0.1,
    });
    const input: LoreRetrievalInput = {
      entries: [lowProb, highProb],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches[0].entry.id).toBe('high');
  });

  it('maintains deterministic order with multiple entries', () => {
    const entries = [
      baseEntry({ id: 'a', priority: 2, insertionOrder: 2 }),
      baseEntry({ id: 'b', priority: 3, insertionOrder: 1 }),
      baseEntry({ id: 'c', priority: 1, insertionOrder: 0 }),
      baseEntry({ id: 'd', priority: 3, insertionOrder: 0 }),
    ];
    const input: LoreRetrievalInput = {
      entries,
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    const ids = result.matches.map((m) => m.entry.id);
    // Expected: d (p3,i0), b (p3,i1), a (p2,i2), c (p1,i0)
    expect(ids).toEqual(['d', 'b', 'a', 'c']);
  });
});

describe('LoreRuntime — Constant Entries', () => {
  it('includes constant entries without keyword match', () => {
    const constant = baseEntry({ id: 'const', constant: true });
    const input: LoreRetrievalInput = {
      entries: [constant],
      queryKeywords: ['nonexistent'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedKeyType).toBeNull();
  });

  it('constant entries have null matchedKey', () => {
    const constant = baseEntry({ id: 'const', constant: true });
    const input: LoreRetrievalInput = {
      entries: [constant],
      queryKeywords: ['anything'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches[0].matchedKey).toBeUndefined();
  });
});

describe('LoreRuntime — Disabled Entries', () => {
  it('excludes disabled entries', () => {
    const enabled = baseEntry({ id: 'on', enabled: true });
    const disabled = baseEntry({ id: 'off', enabled: false });
    const input: LoreRetrievalInput = {
      entries: [enabled, disabled],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].entry.id).toBe('on');
  });
});

describe('LoreRuntime — Cooldown', () => {
  it('excludes entries within cooldown window', () => {
    const now = 1000;
    const entry = baseEntry({
      id: 'cooldown',
      cooldown: 500,
      lastMatchedAt: 800,
    });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['magic'],
      config: baseConfig(),
      now,
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(0);
  });

  it('includes entries after cooldown expires', () => {
    const now = 1000;
    const entry = baseEntry({
      id: 'cooldown',
      cooldown: 500,
      lastMatchedAt: 400,
    });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['magic'],
      config: baseConfig(),
      now,
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
  });

  it('entries without cooldown are never excluded', () => {
    const entry = baseEntry({ id: 'no-cooldown', cooldown: undefined });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
  });
});

describe('LoreRuntime — minMessages Threshold', () => {
  it('excludes entries before minMessages threshold', () => {
    const entry = baseEntry({ id: 'late', minMessages: 10 });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['magic'],
      config: baseConfig({ currentMessageCount: 5 }),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(0);
  });

  it('includes entries after minMessages threshold', () => {
    const entry = baseEntry({ id: 'late', minMessages: 5 });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['magic'],
      config: baseConfig({ currentMessageCount: 5 }),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
  });

  it('defaults to 0 if minMessages undefined', () => {
    const entry = baseEntry({ id: 'early', minMessages: undefined });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['magic'],
      config: baseConfig({ currentMessageCount: 0 }),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
  });
});

describe('LoreRuntime — Scope Filtering', () => {
  it('includes world-scope entries always', () => {
    const entry = baseEntry({ id: 'world', scope: 'world' });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['magic'],
      config: baseConfig({ activeCharacterId: undefined }),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
  });

  it('excludes character-scope entries when no active character', () => {
    const entry = baseEntry({ id: 'char', scope: 'character' });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['magic'],
      config: baseConfig({ activeCharacterId: undefined }),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(0);
  });
});

describe('LoreRuntime — Max Lore Cap', () => {
  it('caps results by maxLore config', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      baseEntry({ id: `entry-${i}`, constant: true })
    );
    const input: LoreRetrievalInput = {
      entries,
      queryKeywords: [],
      config: baseConfig({ maxLore: 3 }),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(3);
  });

  it('defaults to maxLore=6', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      baseEntry({ id: `entry-${i}`, constant: true })
    );
    const input: LoreRetrievalInput = {
      entries,
      queryKeywords: [],
      config: { ...baseConfig(), maxLore: undefined },
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(6);
  });
});

describe('LoreRuntime — Token Estimation', () => {
  it('estimates tokens for a single entry (~1 per 4 chars)', () => {
    const entry = baseEntry({
      id: 'tokens',
      content: 'x'.repeat(100),
    });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    // 100 chars / 4 = 25 tokens
    expect(result.estimatedTokens).toBe(25);
  });

  it('sums token cost across multiple entries', () => {
    const entry1 = baseEntry({
      id: 'entry1',
      content: 'x'.repeat(40),
    });
    const entry2 = baseEntry({
      id: 'entry2',
      content: 'x'.repeat(60),
    });
    const input: LoreRetrievalInput = {
      entries: [entry1, entry2],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    // 40/4 + 60/4 = 10 + 15 = 25
    expect(result.estimatedTokens).toBe(25);
  });
});

describe('LoreRuntime — Runtime Guards (Security)', () => {
  it('rejects entries with activationScript field', () => {
    const malicious = {
      ...baseEntry({ id: 'bad' }),
      activationScript: 'alert("hacked")',
    };
    const input: LoreRetrievalInput = {
      entries: [malicious as LoreEntry],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    expect(() => LoreRuntime.retrieveLore(input)).toThrow('activationScript not allowed');
  });

  it('rejects entries with extensions field', () => {
    const malicious = {
      ...baseEntry({ id: 'bad' }),
      extensions: ['plugin.js'],
    };
    const input: LoreRetrievalInput = {
      entries: [malicious as LoreEntry],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    expect(() => LoreRuntime.retrieveLore(input)).toThrow('extensions not allowed');
  });

  it('rejects entries with executable-looking unknown fields', () => {
    const malicious = {
      ...baseEntry({ id: 'bad' }),
      onMatch: 'executeCode()',
    };
    const input: LoreRetrievalInput = {
      entries: [malicious as LoreEntry],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    expect(() => LoreRuntime.retrieveLore(input)).toThrow('onMatch not recognized');
  });

  it('allows metadata field (safe extension point)', () => {
    const entry = baseEntry({
      id: 'safe',
      metadata: { source: 'janitor', version: 1 },
    });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(1);
  });
});

describe('LoreRuntime — End-to-End Scenarios', () => {
  it('complex multi-entry scenario with mixed conditions', () => {
    const now = 1000;
    const entries = [
      baseEntry({
        id: 'const-low',
        constant: true,
        priority: 1,
        insertionOrder: 2,
      }),
      baseEntry({
        id: 'regular-high',
        keys: ['magic'],
        priority: 10,
        insertionOrder: 0,
      }),
      baseEntry({
        id: 'cooldown-active',
        keys: ['spell'],
        cooldown: 100,
        lastMatchedAt: 950,
      }),
      baseEntry({
        id: 'late-game',
        keys: ['magic'],
        minMessages: 20,
      }),
      baseEntry({
        id: 'secondary',
        keys: ['other'],
        secondaryKeys: ['magic'],
        priority: 5,
        insertionOrder: 1,
      }),
    ];
    const input: LoreRetrievalInput = {
      entries,
      queryKeywords: ['magic'],
      config: baseConfig({ currentMessageCount: 10, maxLore: 3 }),
      now,
    };
    const result = LoreRuntime.retrieveLore(input);
    // Expected order (ranking: isConstant → matchType → priority → insertionOrder):
    // 1. const-low (constant=true, no match, priority 1)
    // 2. regular-high (constant=false, primary match, priority 10)
    // 3. secondary (constant=false, secondary match, priority 5)
    // Excluded: cooldown-active (in cooldown), late-game (minMessages not met)
    expect(result.matches).toHaveLength(3);
    expect(result.matches[0].entry.id).toBe('const-low');
    expect(result.matches[1].entry.id).toBe('regular-high');
    expect(result.matches[2].entry.id).toBe('secondary');
  });

  it('empty result when no keywords match and no constant entries', () => {
    const entry = baseEntry({
      id: 'no-match',
      keys: ['keyword1', 'keyword2'],
      constant: false,
    });
    const input: LoreRetrievalInput = {
      entries: [entry],
      queryKeywords: ['unrelated', 'query'],
      config: baseConfig(),
    };
    const result = LoreRuntime.retrieveLore(input);
    expect(result.matches).toHaveLength(0);
  });

  it('preserves input array (does not mutate)', () => {
    const entry = baseEntry({ id: 'test', priority: 5 });
    const entries = [entry];
    const entriesCopy = JSON.parse(JSON.stringify(entries));
    const input: LoreRetrievalInput = {
      entries,
      queryKeywords: ['magic'],
      config: baseConfig(),
    };
    LoreRuntime.retrieveLore(input);
    expect(entries).toEqual(entriesCopy);
  });
});
