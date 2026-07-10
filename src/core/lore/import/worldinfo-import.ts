// World Info Import — maps SillyTavern World Info JSON (entries as an object
// keyed by index, or an array; singular `key`/`keysecondary` arrays, `disable`
// instead of `enabled`, `order` instead of insertion_order, percent probability)
// onto the internal LoreEntry schema.
// Pure conversion only; safety checks are the caller's job (import-validator).

import type { LoreEntry } from '../lore-types';
import {
  asBoolean,
  asNumber,
  asProbability,
  asString,
  asStringArray,
  buildLoreEntry,
  isRecord,
} from './import-common';

/** Collect the raw entry objects from a World Info document (object map or array). */
export const collectWorldInfoEntries = (
  document: Record<string, unknown>,
): Record<string, unknown>[] => {
  const entries = document.entries;
  if (Array.isArray(entries)) return entries.filter(isRecord);
  if (isRecord(entries)) return Object.values(entries).filter(isRecord);
  return [];
};

/** Convert one World Info entry. */
export const convertWorldInfoEntry = (
  source: Record<string, unknown>,
  index: number,
): LoreEntry => {
  const uid = source.uid;
  const id =
    typeof uid === 'number' || (typeof uid === 'string' && uid !== '')
      ? `wi-${uid}`
      : `worldinfo-${index}`;

  // World Info uses `disable` (true = off); `useProbability` gates whether
  // the percent `probability` applies at all.
  const disabled = asBoolean(source.disable, false);
  const useProbability = asBoolean(source.useProbability, true);
  const probability = useProbability ? asProbability(source.probability) : 1;

  return buildLoreEntry(source, {
    id,
    keys: asStringArray(source.key ?? source.keys),
    secondaryKeys: asStringArray(source.keysecondary),
    content: asString(source.content),
    priority: asNumber(source.priority, 0),
    insertionOrder: asNumber(source.order, index),
    probability,
    enabled: !disabled,
    constant: asBoolean(source.constant, false),
    name: asString(source.name ?? source.title),
    comment: asString(source.comment),
    tags: asStringArray(source.tags),
    position: source.position,
    consumedFields: [
      'uid',
      'key',
      'keys',
      'keysecondary',
      'content',
      'priority',
      'order',
      'probability',
      'useProbability',
      'disable',
      'constant',
      'name',
      'title',
      'comment',
      'tags',
      'position',
    ],
  });
};
