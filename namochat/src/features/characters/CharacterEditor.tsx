import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useCharacterStore } from '../../stores/character-store';
import { useUiStore } from '../../stores/ui-store';
import { Button } from '../../components/ui/button';
import { Input, Label, Textarea } from '../../components/ui/input';
import type { CharacterCard } from '../../core/character/character';
import { generateId } from '../../lib/utils';

const emptyCard = (): CharacterCard => ({
  id: generateId(),
  name: '',
  tagline: '',
  description: '',
  personality: '',
  scenario: '',
  firstMessage: '',
  tags: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const CharacterEditor = ({ characterId }: { characterId?: string }) => {
  const existing = useCharacterStore((s) => s.characters.find((c) => c.id === characterId));
  const upsertCharacter = useCharacterStore((s) => s.upsertCharacter);
  const navigate = useUiStore((s) => s.navigate);
  const [card, setCard] = useState<CharacterCard>(existing ?? emptyCard());
  const [error, setError] = useState('');

  const patch = (fields: Partial<CharacterCard>) => setCard((c) => ({ ...c, ...fields }));

  const save = () => {
    try {
      upsertCharacter(card);
      navigate({ name: 'profile', characterId: card.id });
    } catch (validationError) {
      setError((validationError as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate({ name: 'home' })}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="font-semibold">{existing ? `Edit ${existing.name}` : 'New character'}</h1>
        <Button size="sm" onClick={save}>
          <Save size={14} /> Save
        </Button>
      </div>

      {error && (
        <p className="mb-3 rounded-xl bg-rose-flame/10 px-3 py-2 text-xs text-rose-flame">{error}</p>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Name *</Label>
            <Input value={card.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Rin" />
          </div>
          <div>
            <Label>Tagline</Label>
            <Input
              value={card.tagline}
              onChange={(e) => patch({ tagline: e.target.value })}
              placeholder="One-line hook"
            />
          </div>
        </div>
        <div>
          <Label>Avatar URL</Label>
          <Input
            value={card.avatarUrl ?? ''}
            onChange={(e) => patch({ avatarUrl: e.target.value || undefined })}
            placeholder="https://… or data:image/…"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            rows={4}
            value={card.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Who is this character?"
          />
        </div>
        <div>
          <Label>Personality</Label>
          <Textarea
            rows={2}
            value={card.personality}
            onChange={(e) => patch({ personality: e.target.value })}
          />
        </div>
        <div>
          <Label>Scenario</Label>
          <Textarea rows={2} value={card.scenario} onChange={(e) => patch({ scenario: e.target.value })} />
        </div>
        <div>
          <Label>First message *</Label>
          <Textarea
            rows={3}
            value={card.firstMessage}
            onChange={(e) => patch({ firstMessage: e.target.value })}
            placeholder="*she looks up* Oh. You again."
          />
        </div>
        <div>
          <Label>Example dialogue</Label>
          <Textarea
            rows={3}
            value={card.exampleDialogue ?? ''}
            onChange={(e) => patch({ exampleDialogue: e.target.value || undefined })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input
              value={card.tags.join(', ')}
              onChange={(e) =>
                patch({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
              }
            />
          </div>
          <div>
            <Label>Reply language</Label>
            <Input
              value={card.language ?? ''}
              onChange={(e) => patch({ language: e.target.value || undefined })}
              placeholder="th / en / …"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
