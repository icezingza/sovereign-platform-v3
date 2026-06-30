import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { ArchiveKnowledgeHandler } from '../../application/knowledge/commands/archive-knowledge.handler';
import { CreateKnowledgeHandler } from '../../application/knowledge/commands/create-knowledge.handler';
import { RestoreKnowledgeHandler } from '../../application/knowledge/commands/restore-knowledge.handler';
import { GetKnowledgeByIdHandler } from '../../application/knowledge/queries/get-knowledge-by-id.handler';
import { ListKnowledgeHandler } from '../../application/knowledge/queries/list-knowledge.handler';
import { KnowledgeStatus } from '../../domain/knowledge/knowledge-status';
import { parseListQuery } from './list-query.util';

interface CreateKnowledgeBody {
  content: string;
}

@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly createKnowledgeHandler: CreateKnowledgeHandler,
    private readonly getKnowledgeByIdHandler: GetKnowledgeByIdHandler,
    private readonly listKnowledgeHandler: ListKnowledgeHandler,
    private readonly archiveKnowledgeHandler: ArchiveKnowledgeHandler,
    private readonly restoreKnowledgeHandler: RestoreKnowledgeHandler,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: CreateKnowledgeBody): Promise<{ id: string }> {
    if (!body || typeof body.content !== 'string') {
      throw new BadRequestException('"content" must be a string');
    }
    const id = await this.createKnowledgeHandler.execute(body);
    return { id: id.value };
  }

  @Get()
  async list(@Query() query: Record<string, unknown>) {
    const params = parseListQuery(query, Object.values(KnowledgeStatus));
    return this.listKnowledgeHandler.execute(params);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const snapshot = await this.getKnowledgeByIdHandler.execute({ id });
    if (!snapshot) throw new NotFoundException(`Knowledge not found: ${id}`);
    return snapshot;
  }

  @Post(':id/archive')
  @HttpCode(204)
  async archive(@Param('id') id: string): Promise<void> {
    await this.archiveKnowledgeHandler.execute({ id });
  }

  @Post(':id/restore')
  @HttpCode(204)
  async restore(@Param('id') id: string): Promise<void> {
    await this.restoreKnowledgeHandler.execute({ id });
  }
}
