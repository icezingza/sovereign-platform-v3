export class MemoryId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
    Object.freeze(this);
  }

  static create(value: string): MemoryId {
    const trimmed = value?.trim();
    if (!trimmed) throw new Error('MemoryId cannot be empty');
    return new MemoryId(trimmed);
  }

  get value(): string {
    return this._value;
  }

  equals(other: MemoryId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
