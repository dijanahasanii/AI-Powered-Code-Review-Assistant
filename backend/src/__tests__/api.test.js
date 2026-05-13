// ── Tests: Auth Middleware ────────────────────────────────────────────────────
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');

// Mock Supabase so tests don't hit real DB
jest.mock('../config/database', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'probe-row' }, error: null }),
    single: jest.fn().mockResolvedValue({
      data: { id: 'user-uuid-1', username: 'testuser', email: 'test@example.com', avatar_url: null },
      error: null,
    }),
    insert: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    in: jest.fn().mockReturnThis(),
  },
}));

// Helper: generate a valid JWT for tests
const makeToken = (userId = 'user-uuid-1') =>
  jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

describe('Health check', () => {
  it('GET /health returns 200 with review AI info and database probe', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(res.body.reviewAi).toBeDefined();
    expect(typeof res.body.reviewAi.usesOpenAiApi).toBe('boolean');
    expect(res.body.reviewAi.mode).toBeTruthy();
    expect(res.body.database).toBeDefined();
    expect(typeof res.body.database.reachable).toBe('boolean');
  });
});

describe('GitHub OAuth redirect', () => {
  it('redirects to GitHub authorize URL with signed state', async () => {
    const res = await request(app).get('/api/auth/github').redirects(0);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const loc = res.headers.location || '';
    expect(loc).toMatch(/https:\/\/github\.com\/login\/oauth\/authorize\?/);
    expect(loc).toMatch(/client_id=test-github-oauth-client-id/);
    expect(loc).toMatch(/[?&]state=/);
  });
});

describe('GitHub OAuth callback state', () => {
  it('rejects token exchange when state is missing or invalid', async () => {
    const res = await request(app).get('/api/auth/github/callback').query({
      code: 'dummy-oauth-code',
      redirect_uri: 'http://localhost:5173/auth/callback',
    });
    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toMatch(/state|session|sign-in/i);
  });
});

describe('Auth middleware', () => {
  it('rejects request with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects request with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });

  it('accepts valid JWT token', async () => {
    const token = makeToken();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Reviews API', () => {
  it('GET /api/reviews requires auth', async () => {
    const res = await request(app).get('/api/reviews');
    expect(res.status).toBe(401);
  });

  it('GET /api/reviews returns list with valid token', async () => {
    const token = makeToken();
    const res = await request(app)
      .get('/api/reviews')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

describe('Webhook signature verification', () => {
  const crypto = require('crypto');

  it('GET webhook URL returns probe JSON (GitHub uses POST only)', async () => {
    const res = await request(app).get('/api/webhooks/github');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
    expect(res.body.message).toMatch(/POST/i);
  });

  it('rejects webhook with missing signature', async () => {
    const res = await request(app)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ repository: { id: 1 } }));
    expect(res.status).toBe(401);
  });

  it('rejects webhook with incorrect signature', async () => {
    const body = JSON.stringify({ repository: { id: 1 } });
    const res = await request(app)
      .post('/api/webhooks/github')
      .set('x-hub-signature-256', 'sha256=invalidsignature')
      .set('x-github-event', 'push')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(401);
  });

  it('accepts webhook with valid signature', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'testsecret';
    const body = JSON.stringify({ repository: { id: 999 }, ref: 'refs/heads/main', head_commit: null });
    const sig = `sha256=${crypto.createHmac('sha256', 'testsecret').update(body).digest('hex')}`;

    const res = await request(app)
      .post('/api/webhooks/github')
      .set('x-hub-signature-256', sig)
      .set('x-github-event', 'push')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
  });
});
