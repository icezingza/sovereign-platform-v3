// Character Book Import — maps a SillyTavern Character Book v2 (standalone
// book export, or the `data.character_book` of a full chara_card_v2 card)
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

/** Unwrap a full card export down to the character book, if wrapped. */
const unwrapBook = (document: Record<string, unknown>): Record<string, unknown> => {
  if (
    document.spec === 'chara_card_v2' &&
    isRecord(document.data) &&
    isRecord(document.data.character_book)
  ) {
    return document.data.character_book;
  }
  return document;
};

/** Collect the raw entry objects from a Character Book v2 document. */
export const collectCharacterBookEntries = (
  document: Record<string, unknown>,
): Record<string, unknown>[] => {
  const book = unwrapBook(document);
  return Array.isArray(book.entries) ? book.entries.filter(isRecord) : [];
};

/**
 * Convert one Character Book v2 entry.
 * v2 field notes: `insertion_order` is the spec's ordering field; `priority`
 * is an optional extension used by some frontends; `selective` marks entries
 * whose `secondary_keys` must also match (preserved into metadata.raw since
 * the runtime treats secondary keys as lower-rank, not conjunctive).
 */
export const convertCharacterBookEntry = (
  source: Record<string, unknown>,
  index: number,
): LoreEntry => {
  const sourceId = source.id;
  const id =
    typeof sourceId === 'number' || (typeof sourceId === 'string' && sourceId.length > 0)
      ? `cb-${sourceId}`
      : `characterbook-${index}`;

  return buildLoreEntry(source, {
    id,
    keys: asStringArray(source.keys),
    secondaryKeys: asStringArray(source.secondary_keys),
    content: asString(source.content),
    priority: asNumber(source.priority, 0),
    insertionOrder: asNumber(source.insertion_order, index),
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
      'content',
      'priority',
      'insertion_order',
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
