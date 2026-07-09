// Application service for one chat turn. Orchestrates the core engines
// (emotion → relationship → soul → memory/lore → context → provider →
// stream parser) and writes results back through the stores. This is the
// only module that touches both stores and core engines together.

import { updateAffect, applyDecay } from '../core/emotion/emotion-engine';
import { extractSignals } from '../core/emotion/signal-extractor';
import { RelationshipEngine, DEFAULT_STAGES } from '../core/relationship/relationship-engine';
import { IdentityCapsule } from '../core/identity/identity-capsule';
import { derivePersonaState } from '../core/soul/soul-core';
import { MemoryEngine } from '../core/memory/memory-engine';
import { matchLore } from '../core/lore/lore-engine';
import { summarizeRecent } from '../core/timeline/story-timeline';
import { buildSystemPrompt } from '../core/prompt/prompt-builder';
import { buildTurnContext } from '../core/prompt/context-builder';
import { TokenBudget } from '../core/prompt/token-budget';
import { CognitiveStreamParser } from '../core/cognition/stream-parser';
import { createProvider } from '../core/providers/model-router';
import type { ChatTurn } from '../core/providers/types';
import type { CharacterCard } from '../core/character/character';
import { useChatStore, type Chat, type ChatMessage } from './chat-store';
import { useSettingsStore } from './settings-store';
import { generateId } from '../lib/utils';

const HISTORY_TURNS = 20;
const CONTEXT_WINDOW_TOKENS = 8000;

let activeAbort: AbortController | null = null;

export const stopStreaming = (): void => {
  activeAbort?.abort();
  activeAbort = null;
};

const emptyIdentity = { purpose: [], cognitiveStyle: [], emotionalSignature: [], consistencyRules: [] };

// skipUserMemory: regenerate/continue re-run a turn with either an already-
// remembered user message or an internal directive — neither belongs in
// long-term memory a second time.
const runTurn = async (
  chat: Chat,
  character: CharacterCard,
  userText: string,
  skipUserMemory = false,
): Promise<void> => {
  const chatStore = useChatStore.getState();
  const { provider: providerConfig, userName } = useSettingsStore.getState();

  // 1. Emotion + relationship (pure, synchronous — donor-repo wiring rule).
  const signals = extractSignals(userText);
  const affect = applyDecay(updateAffect(chat.affect, signals));
  const relationshipEngine = new RelationshipEngine(character.stages ?? DEFAULT_STAGES);
  const relationship = relationshipEngine.progress(chat.relationship, affect);

  const previousStage = relationshipEngine.stageOf(chat.relationship).name;
  const currentStage = relationshipEngine.stageOf(relationship).name;
  const timeline =
    currentStage !== previousStage
      ? [
          ...chat.timeline,
          {
            id: generateId(),
            chatId: chat.id,
            kind: 'stage-change' as const,
            title: `Relationship became "${currentStage}"`,
            timestamp: Date.now(),
          },
        ]
      : chat.timeline;

  chatStore.patchChat(chat.id, { affect, relationship, timeline });

  // 2. Soul Core persona state + recalled memories + lore.
  const identity = new IdentityCapsule(character.identity ?? emptyIdentity);
  const persona = derivePersonaState(identity, affect, relationship, relationshipEngine);
  const memoryEngine = new MemoryEngine(chat.memories);
  const memories = memoryEngine.recallLexical(chat.id, userText, 3);
  const lore = matchLore(character.lorebook ?? [], userText);

  // 3. Prompt + budget-gated context.
  const systemPrompt = buildSystemPrompt(character, { userName });
  const history: ChatTurn[] = [
    ...chat.messages.slice(-HISTORY_TURNS).map<ChatTurn>((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userText },
  ];
  const budget = new TokenBudget({
    maxTokens: CONTEXT_WINDOW_TOKENS,
    reservedOutputTokens: providerConfig.maxOutputTokens,
  });
  const context = buildTurnContext({
    persona,
    memories,
    lore,
    storyRecap: summarizeRecent(timeline, chat.id),
    budget,
    historyTexts: history.map((t) => t.content),
    systemPrompt,
  });

  // 4. Stream from the provider through the cognitive-stream parser.
  const provider = createProvider(providerConfig);
  const parser = new CognitiveStreamParser();
  const assistantMessage: ChatMessage = {
    id: generateId(),
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
  };
  chatStore.appendMessage(chat.id, assistantMessage);
  chatStore.setStreamingMessageId(assistantMessage.id);

  activeAbort = new AbortController();
  let visible = '';
  let hasError = false;
  const pushVisible = (text: string) => {
    if (!text) return;
    visible += text;
    useChatStore.getState().updateMessageContent(chat.id, assistantMessage.id, visible);
  };

  try {
    await provider.streamChat(
      { system: systemPrompt, context, history },
      (chunk) => pushVisible(parser.processChunk(chunk).visibleText),
      activeAbort.signal,
    );
    pushVisible(parser.flushRemaining().visibleText);
  } catch (error) {
    hasError = true;
    if ((error as Error).name !== 'AbortError') {
      pushVisible(
        `\n\n> ⚠️ ${(error as Error).message || 'The model request failed. Check Settings.'}`,
      );
    }
  } finally {
    activeAbort = null;
    useChatStore.getState().setStreamingMessageId(null);
  }

  // 5. Persist the turn to long-term memory and re-weight by this turn's
  //    signals (slimmed EvolutionEngine behavior). Error text never becomes
  //    a memory, and re-run turns don't duplicate the user's record.
  const rememberedIds: string[] = [];
  if (!skipUserMemory) {
    rememberedIds.push(
      memoryEngine.remember({
        id: generateId(),
        chatId: chat.id,
        role: 'user',
        content: userText,
        emotionWeight: 0.5,
        timestamp: Date.now(),
      }).id,
    );
  }
  if (visible.trim() && !hasError) {
    memoryEngine.remember({
      id: generateId(),
      chatId: chat.id,
      role: 'character',
      content: visible,
      emotionWeight: 0.5,
      timestamp: Date.now(),
    });
  }
  memoryEngine.evaluateInteraction(
    [...rememberedIds, ...memories.map((m) => m.record.id)],
    signals,
  );
  useChatStore.getState().patchChat(chat.id, { memories: memoryEngine.toProps() });
};

const findChatAndCharacter = (
  chatId: string,
  characters: CharacterCard[],
): { chat: Chat; character: CharacterCard } | null => {
  const chat = useChatStore.getState().chats.find((c) => c.id === chatId);
  if (!chat) return null;
  const character = characters.find((c) => c.id === chat.characterId);
  return character ? { chat, character } : null;
};

export const sendMessage = async (
  chatId: string,
  userText: string,
  characters: CharacterCard[],
): Promise<void> => {
  const found = findChatAndCharacter(chatId, characters);
  if (!found || !userText.trim()) return;

  useChatStore.getState().appendMessage(chatId, {
    id: generateId(),
    role: 'user',
    content: userText.trim(),
    createdAt: Date.now(),
  });
  const chat = useChatStore.getState().chats.find((c) => c.id === chatId);
  if (!chat) return;
  // Pass the pre-append snapshot semantics: runTurn's history already
  // includes the user turn explicitly, so trim it from the stored copy.
  await runTurn(
    { ...chat, messages: chat.messages.slice(0, -1) },
    found.character,
    userText.trim(),
  );
};

// Regenerate: drop the last assistant message and re-run its user turn.
export const regenerateLast = async (
  chatId: string,
  characters: CharacterCard[],
): Promise<void> => {
  const found = findChatAndCharacter(chatId, characters);
  if (!found) return;
  const { chat, character } = found;

  const lastAssistantIndex = [...chat.messages]
    .map((m, i) => ({ m, i }))
    .reverse()
    .find(({ m }) => m.role === 'assistant')?.i;
  if (lastAssistantIndex === undefined || lastAssistantIndex === 0) return;
  const priorUser = chat.messages
    .slice(0, lastAssistantIndex)
    .reverse()
    .find((m) => m.role === 'user');
  if (!priorUser) return;

  useChatStore.getState().removeMessagesFrom(chatId, chat.messages[lastAssistantIndex].id);
  const trimmed = useChatStore.getState().chats.find((c) => c.id === chatId);
  if (!trimmed) return;
  // History passed to runTurn must not double-count the user turn.
  const historyBase = trimmed.messages.filter((m) => m.id !== priorUser.id);
  await runTurn({ ...trimmed, messages: historyBase }, character, priorUser.content, true);
};

// Continue: ask the character to keep going from where it stopped.
export const continueChat = async (
  chatId: string,
  characters: CharacterCard[],
): Promise<void> => {
  const found = findChatAndCharacter(chatId, characters);
  if (!found) return;
  await runTurn(
    found.chat,
    found.character,
    '(Continue the scene naturally from where you left off — do not repeat yourself.)',
    true,
  );
};
