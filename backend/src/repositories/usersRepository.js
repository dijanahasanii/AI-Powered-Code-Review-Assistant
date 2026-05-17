/**
 * Data access for users (OAuth tokens, etc.).
 */
const { supabase } = require('../config/database');

async function getAccessToken(userId) {
  return supabase.from('users').select('access_token').eq('id', userId).single();
}

async function updateAccessToken(userId, encryptedToken) {
  return supabase
    .from('users')
    .update({ access_token: encryptedToken, updated_at: new Date().toISOString() })
    .eq('id', userId);
}

module.exports = {
  getAccessToken,
  updateAccessToken,
};
