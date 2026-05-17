'use strict';

const usersRepository = require('../repositories/usersRepository');
const { encryptToken, decryptTokenDetailed } = require('../utils/tokenCrypto');

/**
 * Persist GitHub user access token encrypted at rest (current key version).
 * @param {string} plainToken
 * @returns {string}
 */
function encryptGithubTokenForStorage(plainToken) {
  return encryptToken(plainToken);
}

/**
 * Load and decrypt GitHub access token; re-encrypt with CURRENT key when decrypted via PREVIOUS.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function getGithubAccessTokenForUser(userId) {
  const { data, error } = await usersRepository.getAccessToken(userId);
  if (error || !data?.access_token) return null;
  try {
    const detail = decryptTokenDetailed(data.access_token);
    if (!detail) return null;

    if (detail.needsReencrypt) {
      const reencrypted = encryptToken(detail.plaintext);
      await usersRepository.updateAccessToken(userId, reencrypted);
    }

    return detail.plaintext;
  } catch {
    return null;
  }
}

module.exports = {
  encryptGithubTokenForStorage,
  getGithubAccessTokenForUser,
};
