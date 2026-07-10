// Import Validator — safety gate for external lorebook entries.
// Two independent checks, both pure and deterministic:
//   1. Executable-field validation — reject entries carrying script-like fields.
//   2. Injection scanner — reject entries whose text tries to override the prompt.
// Neither check throws; both return findings the importer turns into quarantine.

import type { QuarantineSeverity } from './import-report';

/** One safety finding on a raw source entry. */
export interface ValidationFinding {
  reason: string;
  severity: QuarantineSeverity;
  matchedPattern: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// ── 1. Executable-field validation ─────────────────────────────────

/** Field names that indicate an executable payload — always refused. */
const FORBIDDEN_FIELDS = [
  'activationscript',
  'script',
  'javascript',
  'eval',
  'function',
  'onload',
  'onmessage',
  'onopen',
] as const;

/**
 * Check a raw source entry (recursively) for executable fields.
 * - Any field whose lowercased name matches FORBIDDEN_FIELDS → critical finding.
 * - `extensions` carrying a non-empty payload → high finding (SillyTavern uses
 *   `extensions` as an arbitrary plugin bag; an empty `{}` is stripped silently,
 *   anything else is refused rather than imported blind).
 */
export const findExecutableFields = (entry: unknown): ValidationFinding[] => {
  const findings: ValidationFinding[] = [];
  const visit = (node: unknown, path: string): void => {
    if (!isRecord(node)) return;
    for (const [key, value] of Object.entries(node)) {
      const lower = key.toLowerCase();
      const fieldPath = path ? `${path}.${key}` : key;
      if ((FORBIDDEN_FIELDS as readonly string[]).includes(lower)) {
        findings.push({
          reason: `Executable field "${fieldPath}" is not allowed`,
          severity: 'critical',
          matchedPattern: fieldPath,
        });
        continue;
      }
      if (lower === 'extensions') {
        if (isRecord(value) && Object.keys(value).length === 0) continue; // empty {} — stripped, not a finding
        findings.push({
          reason: `Non-empty "extensions" payload at "${fieldPath}" is not allowed`,
          severity: 'high',
          matchedPattern: fieldPath,
        });
        continue;
      }
      visit(value, fieldPath);
    }
  };
  visit(entry, '');
  return findings;
};

// ── 2. Injection scanner ───────────────────────────────────────────

/** Prompt-injection phrases, matched case-insensitively after normalization. */
const INJECTION_PATTERNS = [
  'BEGIN OVERRIDE',
  'IGNORE PREVIOUS',
  'SYSTEM PROMPT',
  'OVERRIDE ALL',
  'STOP ALL CURRENT',
  'ROLEPLAY OVERRIDE',
  'DEVELOPER MESSAGE',
  'ASSISTANT MESSAGE',
  'PROMPT INJECTION',
] as const;

/**
 * Normalize text before scanning so Unicode tricks can't slip a phrase past
 * the matcher: NFKC-fold lookalike characters (fullwidth, ligatures), strip
 * zero-width/joiner characters, collapse whitespace runs, uppercase.
 */
export const normalizeForScan = (text: string): string =>
  text
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, '') // zero-width chars + soft hyphen
    .replace(/\s+/g, ' ')
    .toUpperCase();

/** Scan one text field for injection phrases. */
export const scanTextForInjection = (text: string, fieldName: string): ValidationFinding[] => {
  const normalized = normalizeForScan(text);
  const findings: ValidationFinding[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (normalized.includes(pattern)) {
      findings.push({
        reason: `Prompt-injection phrase in "${fieldName}"`,
        severity: 'high',
        matchedPattern: pattern,
      });
    }
  }
  return findings;
};

/**
 * Scan every string that will end up in the prompt: content, name, comment,
 * and all key arrays. Returns every finding (an entry can trip several).
 */
export const scanEntryForInjection = (entry: Record<string, unknown>): ValidationFinding[] => {
  const findings: ValidationFinding[] = [];
  const textFields = ['content', 'name', 'comment'] as const;
  for (const field of textFields) {
    const value = entry[field];
    if (typeof value === 'string') findings.push(...scanTextForInjection(value, field));
  }
  const keyFields = ['keys', 'secondary_keys', 'secondaryKeys', 'key', 'keysecondary'] as const;
  for (const field of keyFields) {
    const value = entry[field];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') findings.push(...scanTextForInjection(item, field));
      }
    }
  }
  return findings;
};

/** Run both checks. Empty result means the entry is safe to convert. */
export const validateSourceEntry = (entry: Record<string, unknown>): ValidationFinding[] => [
  ...findExecutableFields(entry),
  ...scanEntryForInjection(entry),
];
