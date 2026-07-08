import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { ArchiveMemoryHandler } from '../../application/memory/commands/archive-memory.handler';
import { CreateMemoryHandler } from '../../application/memory/commands/create-memory.handler';
import { DeleteMemoryHandler } from '../../application/memory/commands/delete-memory.handler';
import { ForgetMemoryHandler } from '../../application/memory/commands/forget-memory.handler';
import { LinkKnowledgeHandler } from '../../application/memory/commands/link-knowledge.handler';
import { RestoreMemoryHandler } from '../../application/memory/commands/restore-memory.handler';
import { GetMemoryByIdHandler } from '../../application/memory/queries/get-memory-by-id.handler';
import { ListMemoriesHandler } from '../../application/memory/queries/list-memories.handler';
import { MemoryStatus } from '../../domain/memory/memory-status';
import { parseListQuery } from './list-query.util';

interface CreateMemoryBody {
  content: string;
  importance: number;
}

interface LinkKnowledgeBody {
  knowledgeId: string;
}

@Controller('memories')
export class MemoryController {
  constructor(
    private readonly createMemoryHandler: CreateMemoryHandler,
    private readonly getMemoryByIdHandler: GetMemoryByIdHandler,
    private readonly listMemoriesHandler: ListMemoriesHandler,
    private readonly archiveMemoryHandler: ArchiveMemoryHandler,
    private readonly restoreMemoryHandler: RestoreMemoryHandler,
    private readonly forgetMemoryHandler: ForgetMemoryHandler,
    private readonly deleteMemoryHandler: DeleteMemoryHandler,
    private readonly linkKnowledgeHandler: LinkKnowledgeHandler,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: CreateMemoryBody): Promise<{ id: string }> {
    if (!body || typeof body.content !== 'string' || typeof body.importance !== 'number') {
      throw new BadRequestException(
        '"content" must be a string and "importance" must be a number',
      );
    }
    const id = await this.createMemoryHandler.execute(body);
    return { id: id.value };
  }

  @Get()
  async list(@Query() query: Record<string, unknown>) {
    const params = parseListQuery(query, Object.values(MemoryStatus));
    return this.listMemoriesHandler.execute(params);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const snapshot = await this.getMemoryByIdHandler.execute({ id });
    if (!snapshot) throw new NotFoundException(`MemoryRecord not found: ${id}`);
    return snapshot;
  }

  @Post(':id/archive')
  @HttpCode(204)
  async archive(@Param('id') id: string): Promise<void> {
    await this.archiveMemoryHandler.execute({ id });
  }

  @Post(':id/restore')
  @HttpCode(204)
  async restore(@Param('id') id: string): Promise<void> {
    await this.restoreMemoryHandler.execute({ id });
  }

  @Post(':id/forget')
  @HttpCode(204)
  async forget(@Param('id') id: string): Promise<void> {
    await this.forgetMemoryHandler.execute({ id });
  }

  @Post(':id/link-knowledge')
  @HttpCode(204)
  async linkKnowledge(@Param('id') id: string, @Body() body: LinkKnowledgeBody): Promise<void> {
    if (!body || typeof body.knowledgeId !== 'string') {
      throw new BadRequestException('"knowledgeId" must be a string');
    }
    await this.linkKnowledgeHandler.execute({ id, knowledgeId: body.knowledgeId });
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.deleteMemoryHandler.execute({ id });
  }
}
