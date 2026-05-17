'use strict';

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
/** New ciphertext always uses this version prefix. */
const ENCRYPT_VERSION = 2;

/**
 * Resolve encryption key material from env (CURRENT > legacy TOKEN_ENCRYPTION_KEY).
 */
function readKeyMaterial(envVar) {
  const raw = process.env[envVar];
  if (raw == null || typeof raw !== 'string' || !raw.trim()) return null;
  const t = raw.trim();
  if (/^[0-9a-f]{64}$/i.test(t)) {
    return Buffer.from(t, 'hex');
  }
  try {
    const buf = Buffer.from(t, 'base64');
    if (buf.length === 32) return buf;
  } catch {
    /* fall through */
  }
  return null;
}

function getCurrentKeyBuffer() {
  const fromCurrent = readKeyMaterial('TOKEN_ENCRYPTION_KEY_CURRENT');
  if (fromCurrent) return fromCurrent;
  const legacy = readKeyMaterial('TOKEN_ENCRYPTION_KEY');
  if (legacy) return legacy;
  const err = new Error(
    'TOKEN_ENCRYPTION_KEY_CURRENT (or legacy TOKEN_ENCRYPTION_KEY) is not set or invalid'
  );
  err.code = 'TOKEN_ENCRYPTION_KEY_MISSING';
  throw err;
}

function getPreviousKeyBuffer() {
  return readKeyMaterial('TOKEN_ENCRYPTION_KEY_PREVIOUS');
}

function getDecryptKeyCandidates() {
  const seen = new Set();
  const list = [];

  const add = (id, buf) => {
    if (!buf) return;
    const fp = buf.toString('hex');
    if (seen.has(fp)) return;
    seen.add(fp);
    list.push({ id, buf });
  };

  add('current', getCurrentKeyBuffer());
  add('previous', getPreviousKeyBuffer());
  add('legacy', readKeyMaterial('TOKEN_ENCRYPTION_KEY'));

  return list;
}

function encryptBody(plain, keyBuf) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, keyBuf, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptBody(body, keyBuf) {
  const parts = body.split('.');
  if (parts.length !== 3) {
    throw new Error('decryptToken: invalid encrypted token format');
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(ctB64, 'base64url');
  const decipher = crypto.createDecipheriv(ALGO, keyBuf, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

/**
 * @param {string} plain
 * @returns {string}
 */
function encryptToken(plain) {
  if (plain == null || typeof plain !== 'string' || !plain) {
    throw new Error('encryptToken: token must be a non-empty string');
  }
  const key = getCurrentKeyBuffer();
  const body = encryptBody(plain, key);
  return `v${ENCRYPT_VERSION}:${body}`;
}

/**
 * @param {string} stored
 * @returns {{ plaintext: string, needsReencrypt: boolean }|null}
 */
function decryptTokenDetailed(stored) {
  if (stored == null || typeof stored !== 'string' || !stored) return null;

  const versionMatch = stored.match(/^v(\d+):(.+)$/s);
  if (!versionMatch) {
    return { plaintext: stored, needsReencrypt: false };
  }

  const version = parseInt(versionMatch[1], 10);
  const body = versionMatch[2];
  const candidates = getDecryptKeyCandidates();

  for (const { id, buf } of candidates) {
    try {
      const plaintext = decryptBody(body, buf);
      const needsReencrypt = id !== 'current' || version < ENCRYPT_VERSION;
      return { plaintext, needsReencrypt };
    } catch {
      /* try next key */
    }
  }

  throw new Error('decryptToken: could not decrypt with current or previous keys');
}

/**
 * @param {string} stored
 * @returns {string|null}
 */
function decryptToken(stored) {
  const detail = decryptTokenDetailed(stored);
  return detail ? detail.plaintext : null;
}

function isEncryptedToken(stored) {
  return typeof stored === 'string' && /^v\d+:/.test(stored);
}

function validateTokenEncryptionKey() {
  const current =
    readKeyMaterial('TOKEN_ENCRYPTION_KEY_CURRENT') || readKeyMaterial('TOKEN_ENCRYPTION_KEY');
  if (!current) {
    return 'TOKEN_ENCRYPTION_KEY_CURRENT (or TOKEN_ENCRYPTION_KEY) must be set in production (32-byte key as 64 hex chars or base64).';
  }
  const previous = readKeyMaterial('TOKEN_ENCRYPTION_KEY_PREVIOUS');
  if (process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS && !previous) {
    return 'TOKEN_ENCRYPTION_KEY_PREVIOUS is set but invalid (must be 32 bytes as 64 hex chars or base64).';
  }
  return null;
}

module.exports = {
  encryptToken,
  decryptToken,
  decryptTokenDetailed,
  isEncryptedToken,
  getCurrentKeyBuffer,
  validateTokenEncryptionKey,
  ENCRYPT_VERSION,
};
