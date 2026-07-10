# Lore Import Adapter — Implementation Report (Phase 4B Sprint 2)

**Status:** Done · **Module:** `src/core/lore/import/` · **Tests:** 56 (298 total, zero regressions)

## Scope

A pure import adapter that converts external lorebook formats into the internal
`LoreEntry` schema (Phase 4B Sprint 1, `src/core/lore/lore-types.ts`). It is a
conversion layer only: no Prompt Builder, no Context Allocator, no retrieval
runtime, no storage, no UI, no feature flags. `importLorebook(input)` takes a
JSON string or a parsed document and returns `{ entries, report }` — it never
throws.

## Supported formats

| Format | Detection markers | Entry container |
|---|---|---|
| **Janitor** | flat `entries` array of `{ keys, content }` without v2 markers | array |
| **CharacterBookV2** | `spec: 'chara_card_v2'` wrapper, or entries with `extensions` / `case_sensitive` / `selective` | array (unwrapped from `data.character_book` when card-wrapped) |
| **WorldInfo** | `entries` as an object map, or entries with singular `key` / `keysecondary` / `disable` / `uid` | object map or array |
| **Unknown** | anything else | — (empty result + warning) |

`insertion_order` is deliberately **not** a CharacterBookV2 marker: Janitor
exports carry it too, and the v2 spec already requires `extensions` on every
entry, so `extensions` is the reliable discriminator.

## Pipeline

```
importLorebook(input)
  → parse           (string input JSON.parsed; broken JSON → Unknown + warning)
  → detectFormat    (heuristics above)
  → collect         (per-format entry collection)
  → validate        (executable fields + injection scan; findings → quarantine)
  → convert         (per-format mapper → LoreEntry, defaults for missing fields)
  → report          (ImportReport with counts, warnings, quarantine, statistics)
```

## Field mapping

| Source | LoreEntry | Notes |
|---|---|---|
| `keys` / `key` | `keys` | non-strings dropped |
| `secondary_keys` / `secondaryKeys` / `keysecondary` | `secondaryKeys` | omitted when empty |
| `content` | `content` | empty → entry skipped with warning |
| `priority` | `priority` | default `0` |
| `insertion_order` / `order` | `insertionOrder` | default = source index (deterministic) |
| `probability` | `probability` | values > 1 treated as percent and divided by 100, clamped to [0,1]; WorldInfo `useProbability: false` → `1` |
| `enabled` / `disable` (inverted) | `enabled` | default `true` |
| `constant` | `constant` | default `false` |
| `id` / `uid` | `id` | prefixed per format (`cb-`, `wi-`); fallback `<format>-<index>`; duplicates suffixed `-dup-<index>` |
| `name`, `comment`, `tags`, `position` | `metadata.name/comment/tags/position` | only when present |
| *anything unmapped* | `metadata.raw` | preserved verbatim — no silent data loss |

`scope` is always `'world'` on import; character-scoping is an authoring
decision made later, not something the source formats express in a portable way.

## Safety model

Two independent checks run on every raw source entry **before** conversion
(`src/core/lore/import/import-validator.ts`). Any finding quarantines the
entry — it is never imported, and healthy entries in the same file still are.

### 1. Executable-field validation (severity: critical)

Recursively rejects any field named (case-insensitive):
`activationScript`, `script`, `javascript`, `eval`, `function`, `onLoad`,
`onMessage`, `onOpen`.

`extensions` is special-cased: the Character Book v2 spec requires it on every
entry, so an **empty** `{}` is stripped silently; a **non-empty** payload is
quarantined at `high` severity rather than imported blind.

### 2. Prompt-injection scanner (severity: high)

Scans `content`, `name`, `comment`, and every key array for:
`BEGIN OVERRIDE`, `IGNORE PREVIOUS`, `SYSTEM PROMPT`, `OVERRIDE ALL`,
`STOP ALL CURRENT`, `ROLEPLAY OVERRIDE`, `DEVELOPER MESSAGE`,
`ASSISTANT MESSAGE`, `PROMPT INJECTION`.

Text is normalized first (`normalizeForScan`): Unicode NFKC folding (defeats
fullwidth/ligature lookalikes), zero-width character + soft-hyphen stripping,
whitespace-run collapsing, uppercasing. Verified against zero-width-space,
fullwidth, mixed-case, and newline/tab obfuscation in tests; benign prose
containing the individual words ("the previous king ignored…") does not trip it.

### Quarantine record

```ts
{ entryId: string, reason: string, severity: 'low'|'medium'|'high'|'critical', matchedPattern: string }
```

## Import report

```ts
{
  formatDetected: 'Janitor' | 'CharacterBookV2' | 'WorldInfo' | 'Unknown',
  entriesImported: number,
  entriesSkipped: number,        // unusable (empty content) — not a safety issue
  entriesQuarantined: number,    // distinct entries refused for safety
  warnings: string[],            // parse errors, skips, keyless entries, id dedup
  quarantined: QuarantinedEntry[],
  statistics: {
    totalEntriesFound, constantEntries, disabledEntries,
    entriesWithSecondaryKeys, averageKeysPerEntry,
  },
}
```

## Compatibility guarantees

- Missing fields never throw — every field has a documented default.
- Wrong-typed fields are coerced (non-string keys dropped, string priorities → default).
- Conversion is fully deterministic: no clock, no randomness; same input →
  byte-identical output (covered by a regression test).
- The input document is never mutated.
- Large files: a 2,000-entry book imports losslessly (regression-tested).

## Deferred (out of Sprint 2 scope)

- Wiring imported entries into the Context Allocator / Prompt Composer (Sprint 3).
- Scenario Packs, semantic search, UI, persistence of imported books.
