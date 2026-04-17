import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Rivals API (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);

    const tenant = await prisma.tenant.create({ data: { name: 'TestTenant-Rivals' } });
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `test-rivals-${Date.now()}@local`,
        passwordHash: 'x',
        name: 'Test',
        role: 'owner',
        isActive: true,
      },
    });
    token = jwt.sign({ sub: user.id, email: user.email, role: user.role, tenantId: tenant.id });
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

  it('can create and list rival targets', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/rivals/targets')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.trendyol.com/adidas/tensaur-sport-2-0-beyaz-siyah-unisex-sneaker-gw6422-p-343284968' })
      .expect(201);

    expect(createRes.body?.data?.url || createRes.body?.url).toContain('trendyol.com');

    const listRes = await request(app.getHttpServer())
      .get('/api/rivals/targets')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const arr = listRes.body?.data || listRes.body;
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThan(0);
  });
});
