// Deterministic dummy env for deterministic Jest runs (never real secrets — local test constants only).
// Bound to a random high port BEFORE dotenv so `backend/.env` PORT=3001 does not collide with a dev server.
process.env.PORT = String(38200 + Math.floor(Math.random() * 800));

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-for-jest-suite';
process.env.TOKEN_ENCRYPTION_KEY_CURRENT =
  'a1b2c3d4e5f6789012345678abcdef9012345678abcdef9012345678abcdef90';
process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS =
  'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321';
process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.GITHUB_CLIENT_ID = 'test-github-oauth-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-github-oauth-client-secret';
process.env.SUPABASE_URL = 'https://test.supabase.local';
process.env.SUPABASE_SERVICE_KEY = 'test-service-role-placeholder';
process.env.NODE_ENV = 'test';
