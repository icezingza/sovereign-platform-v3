// Format Detector — identifies which external lorebook format a parsed JSON
// document is. Pure heuristics over the document shape; no I/O, never throws.

import type { DetectedFormat } from './import-report';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** SillyTavern World Info entry markers: singular `key` array, `keysecondary`, `disable`, `order`. */
const looksLikeWorldInfoEntry = (entry: unknown): boolean =>
  isRecord(entry) &&
  (Array.isArray(entry.key) ||
    Array.isArray(entry.keysecondary) ||
    'disable' in entry ||
    'uid' in entry);

/**
 * Character Book v2 entry markers: `extensions`, `case_sensitive`, `selective`.
 * (`insertion_order` is deliberately NOT a marker — Janitor exports carry it
 * too, and the v2 spec requires `extensions` on every entry anyway.)
 */
const looksLikeCharacterBookEntry = (entry: unknown): boolean =>
  isRecord(entry) &&
  ('extensions' in entry || 'case_sensitive' in entry || 'selective' in entry);

/** Janitor-style entry: plural `keys` + `content`, without Character Book v2 markers. */
const looksLikeJanitorEntry = (entry: unknown): boolean =>
  isRecord(entry) && Array.isArray(entry.keys) && typeof entry.content === 'string';

/**
 * Detect the lorebook format of a parsed document.
 *
 * Recognized shapes:
 * - CharacterBookV2 — full card export (`spec: 'chara_card_v2'` with
 *   `data.character_book`), or a standalone character book whose `entries`
 *   array carries v2 markers (`insertion_order`/`extensions`/...).
 * - WorldInfo — SillyTavern world info: `entries` is an OBJECT keyed by index,
 *   or an array of entries with `key`(singular)/`keysecondary`/`disable`/`uid`.
 * - Janitor — an `entries` array of `{ keys, content }` items without v2
 *   markers (Janitor lorebook exports mirror this flat shape).
 * - Unknown — anything else.
 */
export const detectFormat = (document: unknown): DetectedFormat => {
  if (!isRecord(document)) return 'Unknown';

  // Full character card export wrapping a character book.
  if (
    document.spec === 'chara_card_v2' &&
    isRecord(document.data) &&
    isRecord(document.data.character_book)
  ) {
    return 'CharacterBookV2';
  }

  const entries = document.entries;

  // World Info: entries as an object map (the classic ST export shape).
  if (isRecord(entries)) {
    const values = Object.values(entries);
    if (values.length === 0 || values.some(looksLikeWorldInfoEntry)) return 'WorldInfo';
    return 'Unknown';
  }

  if (Array.isArray(entries)) {
    if (entries.length === 0) {
      // Empty book: prefer CharacterBookV2 when the wrapper carries its fields.
      return 'scan_depth' in document || 'token_budget' in document || 'recursive_scanning' in document
        ? 'CharacterBookV2'
        : 'Janitor';
    }
    if (entries.some(looksLikeWorldInfoEntry)) return 'WorldInfo';
    if (entries.some(looksLikeCharacterBookEntry)) return 'CharacterBookV2';
    if (entries.some(looksLikeJanitorEntry)) return 'Janitor';
  }

  return 'Unknown';
};
