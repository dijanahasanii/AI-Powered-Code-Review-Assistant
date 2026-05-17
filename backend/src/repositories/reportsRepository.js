/**
 * Data access for analysis_reports.
 */
const { supabase } = require('../config/database');

async function upsertReport(row) {
  return supabase
    .from('analysis_reports')
    .upsert(row, { onConflict: 'review_id' })
    .select()
    .single();
}

async function findReportByReviewId(reviewId) {
  return supabase.from('analysis_reports').select().eq('review_id', reviewId).single();
}

async function findReportById(reportId) {
  return supabase.from('analysis_reports').select().eq('id', reportId).single();
}

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {number} opts.from
 * @param {number} opts.to
 */
async function listReportsForUser({ userId, from, to }) {
  const { data: repos, error: repoErr } = await supabase
    .from('repositories')
    .select('id')
    .eq('user_id', userId);

  if (repoErr) return { data: null, error: repoErr, count: 0 };
  const repoIds = (repos || []).map((r) => r.id);
  if (!repoIds.length) return { data: [], error: null, count: 0 };

  return supabase
    .from('analysis_reports')
    .select(
      `
        id, review_id, repository_id, repository_name, analyzed_branch,
        commit_sha, report_path, issue_count, severity_summary, analysis_type,
        remediation_status, push_commit_sha, pushed_at, created_at, updated_at
      `,
      { count: 'exact' }
    )
    .in('repository_id', repoIds)
    .order('created_at', { ascending: false })
    .range(from, to);
}

async function getReportWithRepo(reportId) {
  const { data: report, error } = await supabase
    .from('analysis_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error || !report) return { data: null, error };

  const { data: repo, error: repoErr } = await supabase
    .from('repositories')
    .select('id, full_name, user_id, name')
    .eq('id', report.repository_id)
    .single();

  if (repoErr) return { data: null, error: repoErr };
  return { data: { ...report, repositories: repo }, error: null };
}

async function updateReportById(reportId, patch) {
  return supabase
    .from('analysis_reports')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', reportId);
}

async function listReportPathsByRepositoryId(repositoryId) {
  return supabase
    .from('analysis_reports')
    .select('id, report_path')
    .eq('repository_id', repositoryId);
}

async function deleteByRepositoryId(repositoryId) {
  return supabase.from('analysis_reports').delete().eq('repository_id', repositoryId);
}

module.exports = {
  upsertReport,
  findReportByReviewId,
  findReportById,
  listReportsForUser,
  getReportWithRepo,
  updateReportById,
  listReportPathsByRepositoryId,
  deleteByRepositoryId,
};
