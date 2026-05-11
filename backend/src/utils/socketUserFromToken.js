'use strict';

const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

/**
 * Resolve a Supabase user row from a raw JWT string (same semantics as HTTP Bearer for /api/*).
 * Socket clients send the token without "Bearer " prefix in handshake.auth.token.
 *
 * @returns {Promise<object|null>} user row or null if missing/invalid/not found
 */
async function getUserFromSocketToken(token) {
  if (token == null || typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (!trimmed) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  let decoded;
  try {
    decoded = jwt.verify(trimmed, secret);
  } catch {
    return null;
  }

  const userId = decoded?.userId;
  if (!userId || userId === '') return null;

  const { data: user, error } = await supabase
    .from('users')
    .select('id, github_id, username, email, avatar_url')
    .eq('id', userId)
    .single();

  if (error || !user) return null;
  return user;
}

module.exports = { getUserFromSocketToken };
