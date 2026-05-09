'use strict';

const { logger } = require('../utils/logger');
const { fetchRepoSourceFilesAtCommit } = require('./githubService');
const { runStaticRulesOnFiles, capAndSortIssues } = require('../analyzers/staticRules');
const { computeScoreFromIssues } = require('../analyzers/computeScore');
const { buildRepositorySummary } = require('../analyzers/buildSummary');

/**
 * Full snapshot analysis at a commit: Git tree + blobs (no local git clone).
 *
 * @returns {Promise<{ summary: string, overallScore: number|null, issues: object[], positives: string[], snapshotMeta: object }>}
 */
async function analyzeRepositorySnapshot({
  repoFullName,
  commitSha,
  userId,
  language: _language,
}) {
  const short = String(commitSha || '').slice(0, 7);

  const { files, meta } = await fetchRepoSourceFilesAtCommit(repoFullName, commitSha, userId);

  const linesScanned = files.reduce((n, f) => n + String(f.content || '').split(/\r?\n/).length, 0);

  if (!files.length) {
    const msg = `${repoFullName} @ ${short}: we did not find any .js / .ts / .vue files to check (heavy folders like node_modules, dist, build, .git were skipped). This repo commit may hold no app source, only assets, or other languages we do not scan yet.`;
    logger.warn(msg);
    return {
      summary: msg,
      overallScore: null,
      issues: [],
      positives: [
        'If you expected JS/TS/Vue files, make sure they are committed and not only inside skipped folders.',
      ],
      snapshotMeta: meta,
    };
  }

  const rawIssues = runStaticRulesOnFiles(files);
  const issues = capAndSortIssues(rawIssues);

  const overallScore = issues.length === 0 ? 100 : computeScoreFromIssues(issues);

  const summary = buildRepositorySummary(repoFullName, short, { issues, linesScanned, filesScanned: files.length }, meta);

  const positives = [];
  if (!(issues || []).some((i) => i.severity === 'critical')) {
    positives.push('No critical heuristic hits in the scanned tree — still ship real tests and runtime monitoring.');
  }
  positives.push(
    `Coverage: ${files.length} files / ${linesScanned.toLocaleString()} lines (commit ${short}) after ignore rules.`
  );

  logger.info(
    `[repo-analyzer] ${repoFullName}@${short} files=${files.length} issues=${issues.length} score=${overallScore ?? 'n/a'}`
  );

  return {
    summary,
    overallScore,
    issues,
    positives,
    snapshotMeta: meta,
  };
}

module.exports = { analyzeRepositorySnapshot };
