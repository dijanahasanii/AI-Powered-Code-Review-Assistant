/**
 * Data access for repositories (shared across feature areas).
 */
const { supabase } = require('../config/database');

async function findByIdAndUserId(repositoryId, userId) {
  return supabase.from('repositories').select('*').eq('id', repositoryId).eq('user_id', userId).single();
}

async function findById(repositoryId) {
  return supabase.from('repositories').select('id, full_name, user_id').eq('id', repositoryId).single();
}

/**
 * @param {string} userId
 */
async function listIdsForUser(userId) {
  return supabase.from('repositories').select('id').eq('user_id', userId);
}

/**
 * Connected repos with nested review summaries (dashboard list).
 * @param {string} userId
 */
async function listConnectedWithReviewsForUser(userId) {
  return supabase
    .from('repositories')
    .select(
      `
        id, full_name, name, description, language,
        is_private, webhook_active, created_at,
        code_reviews(id, status, overall_score, created_at)
      `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('created_at', { foreignTable: 'code_reviews', ascending: false });
}

/**
 * @param {number|string} githubRepoId
 * @param {string} userId
 */
async function findIdByGithubRepoIdForUser(githubRepoId, userId) {
  return supabase
    .from('repositories')
    .select('id')
    .eq('github_repo_id', githubRepoId)
    .eq('user_id', userId)
    .maybeSingle();
}

/**
 * @param {object} row — DB row for insert
 */
async function insertRepository(row) {
  return supabase.from('repositories').insert(row).select().single();
}

/**
 * @param {string} repositoryId
 * @param {string} userId
 * @param {object} patch
 */
async function updateByIdForUser(repositoryId, userId, patch) {
  return supabase
    .from('repositories')
    .update(patch)
    .eq('id', repositoryId)
    .eq('user_id', userId)
    .select('id, full_name, webhook_id, webhook_active')
    .single();
}

async function deleteById(repositoryId) {
  return supabase.from('repositories').delete().eq('id', repositoryId);
}

module.exports = {
  findByIdAndUserId,
  findById,
  listIdsForUser,
  listConnectedWithReviewsForUser,
  findIdByGithubRepoIdForUser,
  insertRepository,
  updateByIdForUser,
  deleteById,
};
