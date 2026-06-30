export class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplicationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MemoryNotFoundError extends ApplicationError {
  constructor(id: string) {
    super(`MemoryRecord not found: ${id}`);
    this.name = 'MemoryNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
