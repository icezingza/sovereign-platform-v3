import { BadRequestException } from '@nestjs/common';

export interface ListQueryParams<TStatus extends string> {
  status?: TStatus;
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

  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('"limit" must be an integer between 1 and 100');
    }
    result.limit = limit;
  }

  if (query.offset !== undefined) {
    const offset = Number(query.offset);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BadRequestException('"offset" must be a non-negative integer');
    }
    result.offset = offset;
  }

  return result;
}
