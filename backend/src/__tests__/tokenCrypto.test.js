const {
  encryptToken,
  decryptToken,
  decryptTokenDetailed,
  isEncryptedToken,
  ENCRYPT_VERSION,
} = require('../utils/tokenCrypto');

describe('tokenCrypto', () => {
  const originalCurrent = process.env.TOKEN_ENCRYPTION_KEY_CURRENT;
  const originalPrevious = process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
  const originalLegacy = process.env.TOKEN_ENCRYPTION_KEY;

  afterEach(() => {
    if (originalCurrent === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_CURRENT;
    else process.env.TOKEN_ENCRYPTION_KEY_CURRENT = originalCurrent;
    if (originalPrevious === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
    else process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = originalPrevious;
    if (originalLegacy === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = originalLegacy;
  });

  it('encrypts with v2 prefix and decrypts with CURRENT key', () => {
    const plain = 'gho_test_github_access_token_value';
    const stored = encryptToken(plain);
    expect(stored.startsWith(`v${ENCRYPT_VERSION}:`)).toBe(true);
    expect(isEncryptedToken(stored)).toBe(true);
    expect(stored).not.toContain(plain);
    expect(decryptToken(stored)).toBe(plain);
  });

  it('decrypts v1 ciphertext using PREVIOUS key and flags re-encrypt', () => {
    process.env.TOKEN_ENCRYPTION_KEY_CURRENT =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS =
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    const plain = 'gho_rotated_token_value';
    const crypto = require('crypto');
    const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const body = `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
    const stored = `v1:${body}`;

    const detail = decryptTokenDetailed(stored);
    expect(detail.plaintext).toBe(plain);
    expect(detail.needsReencrypt).toBe(true);
  });

  it('returns legacy plaintext tokens unchanged', () => {
    const legacy = 'gho_legacy_plaintext_token';
    const detail = decryptTokenDetailed(legacy);
    expect(detail.plaintext).toBe(legacy);
    expect(detail.needsReencrypt).toBe(false);
    expect(isEncryptedToken(legacy)).toBe(false);
  });
});
