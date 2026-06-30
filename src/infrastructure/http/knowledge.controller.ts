import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';

import { ArchiveKnowledgeHandler } from '../../application/knowledge/commands/archive-knowledge.handler';
import { CreateKnowledgeHandler } from '../../application/knowledge/commands/create-knowledge.handler';
import { RestoreKnowledgeHandler } from '../../application/knowledge/commands/restore-knowledge.handler';
import { GetKnowledgeByIdHandler } from '../../application/knowledge/queries/get-knowledge-by-id.handler';

interface CreateKnowledgeBody {
  content: string;
}

@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly createKnowledgeHandler: CreateKnowledgeHandler,
    private readonly getKnowledgeByIdHandler: GetKnowledgeByIdHandler,
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
