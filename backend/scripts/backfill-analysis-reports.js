/**
 * Create analysis_reports + markdown for completed reviews that have no report yet.
 * Usage: node scripts/backfill-analysis-reports.js
 */
require('dotenv').config();
const { supabase } = require('../src/config/database');
const { generateAndPersistReport } = require('../src/services/reportGeneratorService');
const { logger } = require('../src/utils/logger');

async function main() {
  const { data: completed, error } = await supabase
    .from('code_reviews')
    .select('id, repository_id, commit_sha, branch, triggered_by, status, repositories(name, full_name)')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const { data: existingReports } = await supabase.from('analysis_reports').select('review_id');
  const hasReport = new Set((existingReports || []).map((r) => r.review_id));

  let created = 0;
  for (const review of completed || []) {
    if (hasReport.has(review.id)) continue;

    const { data: issues } = await supabase
      .from('review_issues')
      .select('*')
      .eq('review_id', review.id);

    const issueRows = issues || [];
    const analysis = {
      summary: null,
      overallScore: null,
      issues: issueRows.map((row) => ({
        filePath: row.file_path,
        lineNumber: row.line_number,
        severity: row.severity,
        category: row.category,
        title: row.title,
        description: row.description,
        suggestion: row.suggestion,
        codeSnippet: row.code_snippet,
        matchedRule: row.matched_rule,
      })),
    };

    const { data: reviewFull } = await supabase
      .from('code_reviews')
      .select('summary, overall_score')
      .eq('id', review.id)
      .single();
    if (reviewFull) {
      analysis.summary = reviewFull.summary;
      analysis.overallScore = reviewFull.overall_score;
    }

    const repoName =
      review.repositories?.name || review.repositories?.full_name?.split('/').pop() || 'repository';

    await generateAndPersistReport({
      reviewId: review.id,
      repositoryId: review.repository_id,
      repositoryName: repoName,
      branch: review.branch,
      commitSha: review.commit_sha,
      triggeredBy: review.triggered_by,
      analysis,
    });
    created += 1;
    logger.info(`Backfilled report for review ${review.id.slice(0, 8)}`);
  }

  console.log(`Backfill complete. Created ${created} report(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
