const {
  validateBackendUrl,
  validateTokenEncryptionKey,
  validateNoClientExposedServiceRoleKeys,
} = require('../config/validateProductionEnv');
const { validateCookieSecurity, cookieBaseOptions } = require('../utils/authCookie');

describe('validateBackendUrl', () => {
  it('accepts public HTTPS URLs', () => {
    expect(validateBackendUrl('https://api.example.com')).toBeNull();
  });

  it('rejects missing, http, and localhost URLs', () => {
    expect(validateBackendUrl('')).toMatch(/must be set/i);
    expect(validateBackendUrl('http://api.example.com')).toMatch(/https/i);
    expect(validateBackendUrl('https://localhost:3001')).toMatch(/localhost/i);
    expect(validateBackendUrl('https://127.0.0.1')).toMatch(/localhost/i);
  });
});

describe('validateTokenEncryptionKey', () => {
  const originalCurrent = process.env.TOKEN_ENCRYPTION_KEY_CURRENT;
  const originalLegacy = process.env.TOKEN_ENCRYPTION_KEY;
  const originalPrevious = process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;

  afterEach(() => {
    if (originalCurrent === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_CURRENT;
    else process.env.TOKEN_ENCRYPTION_KEY_CURRENT = originalCurrent;
    if (originalLegacy === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = originalLegacy;
    if (originalPrevious === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
    else process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = originalPrevious;
  });

  it('accepts 64-char hex CURRENT key', () => {
    process.env.TOKEN_ENCRYPTION_KEY_CURRENT =
      'a1b2c3d4e5f6789012345678abcdef9012345678abcdef9012345678abcdef90';
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(validateTokenEncryptionKey()).toBeNull();
  });

  it('rejects missing keys', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY_CURRENT;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(validateTokenEncryptionKey()).toMatch(/TOKEN_ENCRYPTION_KEY/);
  });
});

describe('validateNoClientExposedServiceRoleKeys', () => {
  const original = process.env.VITE_SUPABASE_SERVICE_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.VITE_SUPABASE_SERVICE_KEY;
    else process.env.VITE_SUPABASE_SERVICE_KEY = original;
  });

  it('flags VITE_SUPABASE_SERVICE_KEY', () => {
    process.env.VITE_SUPABASE_SERVICE_KEY = 'leaked';
    const errs = validateNoClientExposedServiceRoleKeys();
    expect(errs.some((e) => e.includes('VITE_SUPABASE_SERVICE_KEY'))).toBe(true);
  });
});

describe('cookie security', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('uses lax + non-secure cookies when SPA and API share origin in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.BACKEND_URL = 'http://localhost:3001';
    process.env.FRONTEND_URL = 'http://localhost:3001';
    const opts = cookieBaseOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe('lax');
    expect(validateCookieSecurity()).toBeNull();
  });

  it('uses none + secure in production when origins differ', () => {
    process.env.NODE_ENV = 'production';
    process.env.BACKEND_URL = 'https://api.example.com';
    process.env.FRONTEND_URL = 'https://app.example.com';
    const opts = cookieBaseOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe('none');
    expect(validateCookieSecurity()).toBeNull();
  });

  it('uses Secure + SameSite=None for localhost cross-port dev (SPA :5173, API :3001)', () => {
    process.env.NODE_ENV = 'development';
    process.env.BACKEND_URL = 'https://tunnel.example.ngrok.io';
    process.env.PORT = '3001';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    const opts = cookieBaseOptions();
    expect(opts.sameSite).toBe('none');
    expect(opts.secure).toBe(true);
    expect(validateCookieSecurity()).toBeNull();
  });
});
