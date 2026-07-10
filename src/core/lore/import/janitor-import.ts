// Janitor Import — maps a Janitor AI lorebook (flat `entries` array with
// plural `keys` + `content`) onto the internal LoreEntry schema.
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

/** Collect the raw entry objects from a Janitor document. */
export const collectJanitorEntries = (document: Record<string, unknown>): Record<string, unknown>[] =>
  Array.isArray(document.entries) ? document.entries.filter(isRecord) : [];

/**
 * Convert one Janitor entry. `index` provides the deterministic fallback id
 * and insertion order for exports that omit them.
 */
export const convertJanitorEntry = (
  source: Record<string, unknown>,
  index: number,
): LoreEntry => {
  const sourceId = source.id;
  const id =
    typeof sourceId === 'string' && sourceId.length > 0
      ? sourceId
      : typeof sourceId === 'number'
        ? String(sourceId)
        : `janitor-${index}`;

  return buildLoreEntry(source, {
    id,
    keys: asStringArray(source.keys),
    secondaryKeys: asStringArray(source.secondary_keys ?? source.secondaryKeys),
    content: asString(source.content),
    priority: asNumber(source.priority, 0),
    insertionOrder: asNumber(source.insertion_order ?? source.insertionOrder, index),
    probability: asProbability(source.probability),
    enabled: asBoolean(source.enabled, true),
    constant: asBoolean(source.constant, false),
    name: asString(source.name),
    comment: asString(source.comment),
    tags: asStringArray(source.tags),
    position: source.position,
    consumedFields: [
      'id',
      'keys',
      'secondary_keys',
      'secondaryKeys',
      'content',
      'priority',
      'insertion_order',
      'insertionOrder',
      'probability',
      'enabled',
      'constant',
      'name',
      'comment',
      'tags',
      'position',
    ],
  });
};
