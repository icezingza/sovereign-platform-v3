// Prompt Builder: the ONLY place persona data becomes prompt text.
// Builds the once-per-chat system prompt from a CharacterCard (+ optional
// IdentityCapsule). No monolithic hardcoded prompt strings anywhere else.

import type { CharacterCard } from '../character/character';
import { IdentityCapsule } from '../identity/identity-capsule';

export interface PromptBuilderOptions {
  userName: string;
}

const section = (label: string, body: string | undefined): string =>
  body && body.trim() ? `## ${label}\n${body.trim()}` : '';

export const buildSystemPrompt = (
  character: CharacterCard,
  options: PromptBuilderOptions,
): string => {
  const identityBlock = character.identity
    ? new IdentityCapsule(character.identity).getSystemContext()
    : '';

  const language = character.language
    ? `Reply primarily in "${character.language}" unless the user clearly switches language.`
    : '';

  return [
    `You are ${character.name}, a roleplay character. Stay fully in character as ${character.name} ` +
      `in an ongoing story with ${options.userName}. Write immersive, contextual, varied replies — ` +
      `never generic filler. Use *asterisks* for actions and narration.`,
    section('Character', character.description),
    section('Personality', character.personality),
    section('Scenario', character.scenario),
    section('Identity', identityBlock),
    section('Example dialogue', character.exampleDialogue),
    language,
  ]
    .filter(Boolean)
    .join('\n\n');
};
