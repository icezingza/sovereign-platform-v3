// Import Report — result types for the lorebook import adapter.
// Pure data structures; no I/O.

import type { LoreEntry } from '../lore-types';

/** Formats the detector can recognize. */
export type DetectedFormat = 'Janitor' | 'CharacterBookV2' | 'WorldInfo' | 'Unknown';

/** Severity of a quarantine decision. */
export type QuarantineSeverity = 'low' | 'medium' | 'high' | 'critical';

/** One entry that was refused import for safety reasons. */
export interface QuarantinedEntry {
  /** Source entry identifier (or a deterministic synthetic id when the source had none). */
  entryId: string;
  /** Human-readable reason for quarantine. */
  reason: string;
  /** How dangerous the finding is. */
  severity: QuarantineSeverity;
  /** The concrete pattern or field name that triggered the quarantine. */
  matchedPattern: string;
}

/** Aggregate numbers about the source document. */
export interface ImportStatistics {
  /** Entries found in the source, importable or not. */
  totalEntriesFound: number;
  /** Imported entries flagged constant (always-active). */
  constantEntries: number;
  /** Imported entries that are disabled at the source. */
  disabledEntries: number;
  /** Imported entries carrying secondary keys. */
  entriesWithSecondaryKeys: number;
  /** Average primary-key count across imported entries (0 when none imported). */
  averageKeysPerEntry: number;
}

/** Full result of one import run. Never thrown — errors surface as warnings/quarantine. */
export interface ImportReport {
  /** Which source format the detector identified. */
  formatDetected: DetectedFormat;
  /** Count of entries successfully converted. */
  entriesImported: number;
  /** Count of entries skipped as unusable (e.g. empty content) — not a safety issue. */
  entriesSkipped: number;
  /** Count of entries refused for safety reasons. */
  entriesQuarantined: number;
  /** Non-fatal notes: stripped fields, defaulted values, parse problems. */
  warnings: string[];
  /** Details for each quarantined entry. */
  quarantined: QuarantinedEntry[];
  /** Aggregate numbers about the run. */
  statistics: ImportStatistics;
}

/** Report plus the converted entries — what `importLorebook` returns. */
export interface ImportResult {
  entries: LoreEntry[];
  report: ImportReport;
}

/** Build statistics from the converted entries. Pure and deterministic. */
export const computeStatistics = (
  entries: LoreEntry[],
  totalEntriesFound: number,
): ImportStatistics => ({
  totalEntriesFound,
  constantEntries: entries.filter((e) => e.constant).length,
  disabledEntries: entries.filter((e) => !e.enabled).length,
  entriesWithSecondaryKeys: entries.filter((e) => (e.secondaryKeys?.length ?? 0) > 0).length,
  averageKeysPerEntry:
    entries.length === 0
      ? 0
      : entries.reduce((sum, e) => sum + e.keys.length, 0) / entries.length,
});
