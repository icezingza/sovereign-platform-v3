// Import Common — shared coercion + mapping helpers for the format importers.
// Compatibility layer: every field has a default, so incomplete exports never throw.

import type { LoreEntry } from '../lore-types';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Coerce to a string array, dropping non-string items. */
export const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

export const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

export const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/** Clamp a probability into [0, 1]; values that look like percentages (>1) are divided by 100. */
export const asProbability = (value: unknown, fallback = 1): number => {
  const n = asNumber(value, fallback);
  const scaled = n > 1 ? n / 100 : n;
  return Math.min(1, Math.max(0, scaled));
};

/** Fields every importer maps explicitly — everything else lands in metadata.raw. */
export interface MappedFields {
  id: string;
  keys: string[];
  secondaryKeys: string[];
  content: string;
  priority: number;
  insertionOrder: number;
  probability: number;
  enabled: boolean;
  constant: boolean;
  name: string;
  comment: string;
  tags: string[];
  position: unknown;
  /** Source field names the importer consumed (used to compute metadata.raw). */
  consumedFields: string[];
}

/**
 * Assemble a LoreEntry from mapped fields. Unconsumed source fields are
 * preserved verbatim under metadata.raw so no information is silently lost
 * (except `extensions`, which the validator already guaranteed is empty and
 * is stripped rather than preserved).
 */
export const buildLoreEntry = (
  source: Record<string, unknown>,
  mapped: MappedFields,
): LoreEntry => {
  const consumed = new Set([...mapped.consumedFields, 'extensions']);
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!consumed.has(key)) raw[key] = value;
  }

  const metadata: Record<string, unknown> = {};
  if (mapped.name) metadata.name = mapped.name;
  if (mapped.comment) metadata.comment = mapped.comment;
  if (mapped.tags.length > 0) metadata.tags = mapped.tags;
  if (mapped.position !== undefined) metadata.position = mapped.position;
  if (Object.keys(raw).length > 0) metadata.raw = raw;

  const entry: LoreEntry = {
    id: mapped.id,
    scope: 'world',
    keys: mapped.keys,
    content: mapped.content,
    priority: mapped.priority,
    insertionOrder: mapped.insertionOrder,
    probability: mapped.probability,
    enabled: mapped.enabled,
    constant: mapped.constant,
  };
  if (mapped.secondaryKeys.length > 0) entry.secondaryKeys = mapped.secondaryKeys;
  if (Object.keys(metadata).length > 0) entry.metadata = metadata;
  return entry;
};
