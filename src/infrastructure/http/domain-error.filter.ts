import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

import { ApplicationError, MemoryNotFoundError } from '../../application/memory/errors/application-error';
import { DomainError } from '../../domain/memory/errors/domain-error';

@Catch(ApplicationError, DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: ApplicationError | DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      error instanceof MemoryNotFoundError ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;

    response.status(status).json({
      statusCode: status,
      error: error.name,
      message: error.message,
    });
  }
}
