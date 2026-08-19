import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('MCP Agent API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/health (GET) is public and reports ok', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as { status: string };
        expect(body.status).toBe('ok');
      });
  });

  it('/api/auth/demo (POST) issues a demo session token', () => {
    return request(app.getHttpServer())
      .post('/api/auth/demo')
      .expect(200)
      .expect((res) => {
        const body = res.body as { accessToken: string; user: { id: string } };
        expect(body.accessToken.split('.')).toHaveLength(3);
        expect(body.user.id).toMatch(/^demo-/);
      });
  });

  it('/api/auth/register (POST) answers 501 coming-soon', () => {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .expect(501)
      .expect((res) => {
        expect((res.body as { message: string }).message).toMatch(
          /coming soon/i,
        );
      });
  });

  it('/api/agent/stream (POST) rejects an unauthenticated request', () => {
    return request(app.getHttpServer())
      .post('/api/agent/stream')
      .send({ question: 'hello' })
      .expect(401);
  });

  it('a demo token gets past auth into validation', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/demo')
      .expect(200);
    const token = (login.body as { accessToken: string }).accessToken;

    // Empty question → 400 proves the request cleared the auth guard
    // without this test needing a live Ollama.
    await request(app.getHttpServer())
      .post('/api/agent/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '' })
      .expect(400);
  });
});
