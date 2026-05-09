const {
  browserOrigin,
  isAllowedFrontendOrigin,
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
});
