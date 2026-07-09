import { describe, expect, it } from 'vitest';
import { TokenBudget } from './token-budget';
import { buildTurnContext } from './context-builder';
import { buildSystemPrompt } from './prompt-builder';
import { matchLore } from '../lore/lore-engine';
import type { CharacterCard } from '../character/character';

describe('TokenBudget', () => {
  it('keeps only candidates that fit after mandatory texts', () => {
    const budget = new TokenBudget({ maxTokens: 30, reservedOutputTokens: 10 });
    // input budget = 20 tokens = 80 chars
    const kept = budget.selectWithinBudget(['x'.repeat(40)], ['y'.repeat(30), 'z'.repeat(200)]);
    expect(kept).toEqual(['y'.repeat(30)]);
  });
});

describe('buildTurnContext', () => {
  it('always includes the persona block and budget-gates the rest', () => {
    const budget = new TokenBudget({ maxTokens: 100, reservedOutputTokens: 10 });
    const context = buildTurnContext({
      persona: {
        moodLine: 'calm',
        stageName: 'Stranger',
        stageDirective: 'Keep distance.',
        attachmentDirective: 'Be cool.',
        distilledIdentity: 'a muse',
      },
      memories: [],
      lore: matchLore([{ id: 'l1', keys: ['beach'], content: 'The beach is cursed.' }], 'we went to the beach'),
      storyRecap: '',
      budget,
      historyTexts: [],
      systemPrompt: 'sys',
    });
    expect(context).toContain('[Persona] a muse');
    expect(context).toContain('[Relationship: Stranger]');
    expect(context).toContain('The beach is cursed.');
  });
});

describe('buildSystemPrompt', () => {
  it('renders card fields and never a hardcoded persona', () => {
    const card: CharacterCard = {
      id: 'c1',
      name: 'Rin',
      tagline: '',
      description: 'A muse.',
      personality: 'playful',
      scenario: 'rooftop bar',
      firstMessage: 'hi',
      tags: [],
      language: 'th',
      createdAt: 0,
      updatedAt: 0,
    };
    const prompt = buildSystemPrompt(card, { userName: 'You' });
    expect(prompt).toContain('You are Rin');
    expect(prompt).toContain('## Scenario\nrooftop bar');
    expect(prompt).toContain('"th"');
  });
});
