export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(from: string, attempted: string) {
    super(`Cannot transition from ${from} to ${attempted}`);
    this.name = 'InvalidStateTransitionError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidOperationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOperationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
