'use strict';

const { supabase } = require('../config/database');

const ACTIVE_STATUSES = ['open', 'reopened'];

async function listAllByRepositoryId(repositoryId) {
  return supabase
    .from('repository_issues')
    .select('*')
    .eq('repository_id', repositoryId);
}

async function listActiveByRepositoryId(repositoryId) {
  return supabase
    .from('repository_issues')
    .select('*')
    .eq('repository_id', repositoryId)
    .in('status', ACTIVE_STATUSES)
    .order('severity', { ascending: true });
}

async function listByRepositoryIdAndFingerprints(repositoryId, fingerprints) {
  if (!fingerprints?.length) {
    return { data: [], error: null };
  }
  return supabase
    .from('repository_issues')
    .select('*')
    .eq('repository_id', repositoryId)
    .in('fingerprint', fingerprints);
}

async function listActiveByRepositoryIds(repositoryIds) {
  if (!repositoryIds?.length) {
    return { data: [], error: null };
  }
  return supabase
    .from('repository_issues')
    .select('severity, repository_id')
    .in('repository_id', repositoryIds)
    .in('status', ACTIVE_STATUSES);
}

async function insertRow(row) {
  return supabase.from('repository_issues').insert(row).select().single();
}

async function updateById(id, patch) {
  return supabase
    .from('repository_issues')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
}

module.exports = {
  ACTIVE_STATUSES,
  listAllByRepositoryId,
  listActiveByRepositoryId,
  listByRepositoryIdAndFingerprints,
  listActiveByRepositoryIds,
  insertRow,
  updateById,
};
