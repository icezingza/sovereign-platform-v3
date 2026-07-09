// Context Builder: assembles the per-turn context block from the Soul Core
// persona state, recalled memories, lore matches and story recap — every
// insertion gated through TokenBudget (donor-repo rule: never append ungated
// context). Pure: takes data in, returns strings out.

import type { PersonaState } from '../soul/soul-core';
import type { MemorySearchResult } from '../memory/memory-record';
import type { LoreMatch } from '../lore/lore-engine';
import { TokenBudget } from './token-budget';

export interface TurnContextInput {
  persona: PersonaState;
  memories: MemorySearchResult[];
  lore: LoreMatch[];
  storyRecap: string; // from StoryTimeline.summarizeRecent
  budget: TokenBudget;
  historyTexts: string[]; // message history that will accompany the request
  systemPrompt: string;
}

export const buildTurnContext = (input: TurnContextInput): string => {
  // Mandatory: persona reminder + stage/attachment directives (small, bounded).
  const personaBlock = [
    `[Persona] ${input.persona.distilledIdentity}`,
    `[Relationship: ${input.persona.stageName}] ${input.persona.stageDirective} ${input.persona.attachmentDirective}`,
  ].join('\n');

  // Optional, priority-ordered candidates trimmed to the remaining budget.
  const candidates: string[] = [];
  if (input.storyRecap) candidates.push(`[Story so far]\n${input.storyRecap}`);
  for (const match of input.lore) {
    candidates.push(`[World] ${match.entry.content}`);
  }
  for (const result of input.memories) {
    candidates.push(`[Memory] ${result.record.content}`);
  }

  const mandatory = [input.systemPrompt, ...input.historyTexts, personaBlock];
  const kept = input.budget.selectWithinBudget(mandatory, candidates);

  return [personaBlock, ...kept].join('\n\n');
};
