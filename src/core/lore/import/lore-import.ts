// Lore Import — the import adapter's entry point.
// Pipeline: parse (if given a string) → detect format → collect raw entries →
// validate each (executable fields + injection scan) → convert safe entries →
// build ImportReport. Never throws: broken JSON, unknown formats, and missing
// fields all surface as report warnings / skips / quarantine instead.
//
// This layer only converts external formats into LoreEntry[]. It does NOT
// touch the Prompt Builder, Context Allocator, or retrieval runtime.

import type { LoreEntry } from '../lore-types';
import { detectFormat } from './format-detector';
import { isRecord } from './import-common';
import {
  computeStatistics,
  type ImportReport,
  type ImportResult,
  type QuarantinedEntry,
} from './import-report';
import { validateSourceEntry } from './import-validator';
import { collectJanitorEntries, convertJanitorEntry } from './janitor-import';
import { collectCharacterBookEntries, convertCharacterBookEntry } from './characterbook-import';
import { collectWorldInfoEntries, convertWorldInfoEntry } from './worldinfo-import';

const emptyReport = (
  formatDetected: ImportReport['formatDetected'],
  warnings: string[],
): ImportResult => ({
  entries: [],
  report: {
    formatDetected,
    entriesImported: 0,
    entriesSkipped: 0,
    entriesQuarantined: 0,
    warnings,
    quarantined: [],
    statistics: computeStatistics([], 0),
  },
});

/** A deterministic identifier for quarantine reports when the source entry has none. */
const sourceEntryId = (source: Record<string, unknown>, index: number): string => {
  const candidate = source.id ?? source.uid;
  if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  if (typeof candidate === 'number') return String(candidate);
  return `entry-${index}`;
};

/**
 * Import a lorebook from a JSON string or an already-parsed document.
 * Format is detected automatically (Janitor / CharacterBookV2 / WorldInfo).
 * Deterministic: the same input always produces the same entries and report.
 */
export const importLorebook = (input: string | unknown): ImportResult => {
  // ── parse ────────────────────────────────────────────────────────
  let document: unknown;
  if (typeof input === 'string') {
    try {
      document = JSON.parse(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return emptyReport('Unknown', [`Invalid JSON: ${message}`]);
    }
  } else {
    document = input;
  }

  if (!isRecord(document)) {
    return emptyReport('Unknown', ['Document is not a JSON object']);
  }

  // ── detect + collect ─────────────────────────────────────────────
  const format = detectFormat(document);
  let rawEntries: Record<string, unknown>[];
  let convert: (source: Record<string, unknown>, index: number) => LoreEntry;
  switch (format) {
    case 'Janitor':
      rawEntries = collectJanitorEntries(document);
      convert = convertJanitorEntry;
      break;
    case 'CharacterBookV2':
      rawEntries = collectCharacterBookEntries(document);
      convert = convertCharacterBookEntry;
      break;
    case 'WorldInfo':
      rawEntries = collectWorldInfoEntries(document);
      convert = convertWorldInfoEntry;
      break;
    case 'Unknown':
      return emptyReport('Unknown', ['Unrecognized lorebook format']);
  }

  // ── validate + convert ───────────────────────────────────────────
  const entries: LoreEntry[] = [];
  const quarantined: QuarantinedEntry[] = [];
  const warnings: string[] = [];
  let entriesSkipped = 0;
  const seenIds = new Set<string>();

  rawEntries.forEach((source, index) => {
    const entryId = sourceEntryId(source, index);

    const findings = validateSourceEntry(source);
    if (findings.length > 0) {
      for (const finding of findings) {
        quarantined.push({
          entryId,
          reason: finding.reason,
          severity: finding.severity,
          matchedPattern: finding.matchedPattern,
        });
      }
      return;
    }

    const entry = convert(source, index);

    if (entry.content.trim() === '') {
      entriesSkipped += 1;
      warnings.push(`Entry "${entryId}" skipped: empty content`);
      return;
    }
    if (entry.keys.length === 0 && !entry.constant) {
      warnings.push(`Entry "${entryId}" has no keys and is not constant; it will never match`);
    }
    if (seenIds.has(entry.id)) {
      warnings.push(`Entry "${entryId}" has a duplicate id; imported with suffix`);
      entry.id = `${entry.id}-dup-${index}`;
    }
    seenIds.add(entry.id);
    entries.push(entry);
  });

  const report: ImportReport = {
    formatDetected: format,
    entriesImported: entries.length,
    entriesSkipped,
    entriesQuarantined: new Set(quarantined.map((q) => q.entryId)).size,
    warnings,
    quarantined,
    statistics: computeStatistics(entries, rawEntries.length),
  };

  return { entries, report };
};
