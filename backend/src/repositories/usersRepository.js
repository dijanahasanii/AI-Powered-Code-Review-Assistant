/**
 * Data access for users (OAuth tokens, etc.).
 */
const { supabase } = require('../config/database');

async function getAccessToken(userId) {
  return supabase.from('users').select('access_token').eq('id', userId).single();
}

module.exports = {
  getAccessToken,
};
