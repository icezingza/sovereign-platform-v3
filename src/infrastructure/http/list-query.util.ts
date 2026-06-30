import { BadRequestException } from '@nestjs/common';

export interface ListQueryParams<TStatus extends string> {
  status?: TStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export function parseListQuery<TStatus extends string>(
  query: Record<string, unknown>,
  validStatuses: readonly TStatus[],
): ListQueryParams<TStatus> {
  const result: ListQueryParams<TStatus> = {};

  if (query.status !== undefined) {
    if (typeof query.status !== 'string' || !validStatuses.includes(query.status as TStatus)) {
      throw new BadRequestException(`"status" must be one of: ${validStatuses.join(', ')}`);
    }
    result.status = query.status as TStatus;
  }

  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.trim().length === 0) {
      throw new BadRequestException('"search" must be a non-empty string');
    }
    if (query.search.length > 200) {
      throw new BadRequestException('"search" must be at most 200 characters');
    }
    result.search = query.search;
  }

  if (query.limit !== undefined) {
    if (typeof query.limit !== 'string' && typeof query.limit !== 'number') {
      throw new BadRequestException('"limit" must be a single string or number');
    }
    const limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('"limit" must be an integer between 1 and 100');
    }
    result.limit = limit;
  }

  if (query.offset !== undefined) {
    if (typeof query.offset !== 'string' && typeof query.offset !== 'number') {
      throw new BadRequestException('"offset" must be a single string or number');
    }
    const offset = Number(query.offset);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BadRequestException('"offset" must be a non-negative integer');
    }
    result.offset = offset;
  }

  return result;
}
