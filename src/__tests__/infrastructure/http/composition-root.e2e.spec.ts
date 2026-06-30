import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../../app.module';

describe('Composition root (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, retrieves, and archives a memory through the wired handlers', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/memories')
      .send({ content: 'remember the milk', importance: 7 })
      .expect(201);

    const { id } = createResponse.body;
    expect(typeof id).toBe('string');

    const getResponse = await request(app.getHttpServer()).get(`/memories/${id}`).expect(200);

    expect(getResponse.body).toMatchObject({
      id,
      content: 'remember the milk',
      importance: 7,
      status: 'ACTIVE',
      version: 1,
    });

    await request(app.getHttpServer()).post(`/memories/${id}/archive`).expect(204);

    const afterArchive = await request(app.getHttpServer()).get(`/memories/${id}`).expect(200);
    expect(afterArchive.body.status).toBe('ARCHIVED');
    expect(afterArchive.body.version).toBe(2);
  });

  it('returns 404 when getting a memory that does not exist', async () => {
    await request(app.getHttpServer()).get('/memories/does-not-exist').expect(404);
  });

  it('returns 409 when archiving an already-deleted memory', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/memories')
      .send({ content: 'temp', importance: 3 })
      .expect(201);
    const { id } = createResponse.body;

    await request(app.getHttpServer()).delete(`/memories/${id}`).expect(204);

    await request(app.getHttpServer()).post(`/memories/${id}/archive`).expect(409);
  });

  it('returns 400 when creating a memory with a malformed body', async () => {
    await request(app.getHttpServer())
      .post('/memories')
      .send({ content: 'missing importance' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/memories')
      .send({ content: 'wrong type', importance: 'high' })
      .expect(400);
  });

  it('returns 400 when linking knowledge with a malformed body', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/memories')
      .send({ content: 'link target', importance: 4 })
      .expect(201);
    const { id } = createResponse.body;

    await request(app.getHttpServer()).post(`/memories/${id}/link-knowledge`).send({}).expect(400);
  });

  it('creates, retrieves, archives, and restores a knowledge entry through the wired handlers', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/knowledge')
      .send({ content: 'the sky is blue' })
      .expect(201);

    const { id } = createResponse.body;
    expect(typeof id).toBe('string');

    const getResponse = await request(app.getHttpServer()).get(`/knowledge/${id}`).expect(200);

    expect(getResponse.body).toMatchObject({
      id,
      content: 'the sky is blue',
      status: 'ACTIVE',
      version: 1,
    });

    await request(app.getHttpServer()).post(`/knowledge/${id}/archive`).expect(204);
    const afterArchive = await request(app.getHttpServer()).get(`/knowledge/${id}`).expect(200);
    expect(afterArchive.body.status).toBe('ARCHIVED');
    expect(afterArchive.body.version).toBe(2);

    await request(app.getHttpServer()).post(`/knowledge/${id}/restore`).expect(204);
    const afterRestore = await request(app.getHttpServer()).get(`/knowledge/${id}`).expect(200);
    expect(afterRestore.body.status).toBe('ACTIVE');
    expect(afterRestore.body.version).toBe(3);
  });

  it('returns 404 when getting a knowledge entry that does not exist', async () => {
    await request(app.getHttpServer()).get('/knowledge/does-not-exist').expect(404);
  });

  it('links an existing knowledge entry to a memory', async () => {
    const memoryResponse = await request(app.getHttpServer())
      .post('/memories')
      .send({ content: 'link source', importance: 5 })
      .expect(201);
    const memoryId = memoryResponse.body.id;

    const knowledgeResponse = await request(app.getHttpServer())
      .post('/knowledge')
      .send({ content: 'link target knowledge' })
      .expect(201);
    const knowledgeId = knowledgeResponse.body.id;

    await request(app.getHttpServer())
      .post(`/memories/${memoryId}/link-knowledge`)
      .send({ knowledgeId })
      .expect(204);

    const getResponse = await request(app.getHttpServer())
      .get(`/memories/${memoryId}`)
      .expect(200);
    expect(getResponse.body.references).toEqual([knowledgeId]);
  });

  it('returns 404 when linking a non-existent knowledge entry to a memory', async () => {
    const memoryResponse = await request(app.getHttpServer())
      .post('/memories')
      .send({ content: 'link source 2', importance: 5 })
      .expect(201);
    const memoryId = memoryResponse.body.id;

    await request(app.getHttpServer())
      .post(`/memories/${memoryId}/link-knowledge`)
      .send({ knowledgeId: 'does-not-exist' })
      .expect(404);
  });
});
