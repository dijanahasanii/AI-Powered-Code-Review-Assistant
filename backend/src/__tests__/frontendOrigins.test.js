const {
  browserOrigin,
  isAllowedFrontendOrigin,
  isDevelopmentRelaxedOrigin,
  primaryFrontendBase,
  parseCommaOrigins,
} = require('../utils/frontendOrigins');

describe('frontendOrigins', () => {
  it('parses comma-separated URLs', () => {
    expect(parseCommaOrigins(' https://a.com/ , https://b.com ')).toEqual([
      'https://a.com/',
      'https://b.com',
    ]);
  });

  it('reports stable browser origins (strips trailing path-only differences)', () => {
    expect(browserOrigin('https://app.example/')).toBe('https://app.example');
    expect(browserOrigin('https://app.example')).toBe('https://app.example');
  });

  it('primaryFrontendBase trims trailing slashes', () => {
    expect(primaryFrontendBase('https://x.com/spa/')).toBe('https://x.com/spa'); // malformed but preserved
    expect(primaryFrontendBase('https://x.com/')).toBe('https://x.com');
  });

  it('allows origins that match FRONTEND_URL ignoring trailing slashes on env entries', () => {
    expect(
      isAllowedFrontendOrigin('https://mysite.example', 'https://mysite.example/', 'production')
    ).toBe(true);
  });

  it('allows missing Origin header (CLI / health probes)', () => {
    expect(isAllowedFrontendOrigin('', undefined, 'test')).toBe(true);
  });

  it('non-production allows LAN and IPv6 loopback without listing them in FRONTEND_URL', () => {
    expect(isAllowedFrontendOrigin('http://192.168.1.10:5173', 'http://localhost:5173', 'test')).toBe(true);
    expect(isAllowedFrontendOrigin('http://10.0.0.5:5173', 'http://localhost:5173', 'development')).toBe(true);
    expect(isAllowedFrontendOrigin('http://172.20.1.1:3000', 'http://localhost:5173', 'test')).toBe(true);
    expect(isAllowedFrontendOrigin('http://[::1]:5173', 'http://localhost:5173', 'test')).toBe(true);
  });

  it('production rejects LAN origins unless listed in FRONTEND_URL', () => {
    expect(isAllowedFrontendOrigin('http://192.168.1.10:5173', 'http://localhost:5173', 'production')).toBe(false);
    expect(
      isAllowedFrontendOrigin('http://192.168.1.10:5173', 'http://192.168.1.10:5173', 'production')
    ).toBe(true);
  });

  it('honours FRONTEND_DEV_EXTRA_ORIGINS only outside production', () => {
    const prev = process.env.FRONTEND_DEV_EXTRA_ORIGINS;
    process.env.FRONTEND_DEV_EXTRA_ORIGINS = 'http://custom.local:5173';
    try {
      expect(isAllowedFrontendOrigin('http://custom.local:5173', 'http://localhost:5173', 'test')).toBe(true);
      expect(isAllowedFrontendOrigin('http://custom.local:5173', 'http://localhost:5173', 'production')).toBe(
        false
      );
    } finally {
      if (prev === undefined) delete process.env.FRONTEND_DEV_EXTRA_ORIGINS;
      else process.env.FRONTEND_DEV_EXTRA_ORIGINS = prev;
    }
  });

  it('isDevelopmentRelaxedOrigin mirrors OAuth / CORS dev rules', () => {
    expect(isDevelopmentRelaxedOrigin('http://localhost:5173', 'test', '')).toBe(true);
    expect(isDevelopmentRelaxedOrigin('http://[::1]:5173', 'development', '')).toBe(true);
    expect(isDevelopmentRelaxedOrigin('http://203.0.113.1:5173', 'test', '')).toBe(false);
    expect(isDevelopmentRelaxedOrigin('http://203.0.113.1:5173', 'production', '')).toBe(false);
  });
});
