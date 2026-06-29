export class KnowledgeId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
    Object.freeze(this);
  }

  static create(value: string): KnowledgeId {
    const trimmed = value?.trim();
    if (!trimmed) throw new Error('KnowledgeId cannot be empty');
    return new KnowledgeId(trimmed);
  }

  get value(): string {
    return this._value;
  }

  equals(other: KnowledgeId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
