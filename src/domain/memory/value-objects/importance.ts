const MIN = 1;
const MAX = 10;

export class Importance {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
    Object.freeze(this);
  }

  static create(value: number): Importance {
    if (!Number.isInteger(value) || value < MIN || value > MAX) {
      throw new Error(`Importance must be an integer between ${MIN} and ${MAX}`);
    }
    return new Importance(value);
  }

  get value(): number {
    return this._value;
  }

  equals(other: Importance): boolean {
    return this._value === other._value;
  }

  isHigherThan(other: Importance): boolean {
    return this._value > other._value;
  }
}
