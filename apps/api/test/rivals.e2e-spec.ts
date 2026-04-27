import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Rivals API (e2e)', () => {
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

  it('GET /api/health/ping returns pong', async () => {
    await request(app.getHttpServer())
      .get('/api/health/ping')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('pong', true);
      });
  });
});

