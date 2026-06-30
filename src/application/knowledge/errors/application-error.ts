import { ApplicationError } from '../../memory/errors/application-error';

export class KnowledgeNotFoundError extends ApplicationError {
  constructor(id: string) {
    super(`Knowledge not found: ${id}`);
    this.name = 'KnowledgeNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
