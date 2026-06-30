export class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplicationError';
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class MemoryNotFoundError extends ApplicationError {
  constructor(id: string) {
    super(`MemoryRecord not found: ${id}`);
    this.name = 'MemoryNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
