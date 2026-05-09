'use strict';

/**
 * Legacy module name retained for imports. Analysis = Git snapshot + static rule engine when possible,
 * falling back to diff-only heuristics if GitHub tree fetch fails.
 */

const { logger } = require('../utils/logger');
const { analyzeRepositorySnapshot } = require('./repositoryAnalyzer');
const { analyzeCode: runLocalAnalysis } = require('./localAnalysisEngine');
const { augmentAnalysisFromDiff } = require('./diffHeuristicAudit');

async function analyzeCode(diffText, repoContext = {}) {
  const { repoName: repoFullName, userId, commitSha, language } = repoContext || {};
  const canSnapshot = Boolean(repoFullName && userId && commitSha);

  if (canSnapshot) {
    try {
      const snap = await analyzeRepositorySnapshot({
        repoFullName,
        commitSha,
        userId,
        language,
      });
      let summary = snap.summary;
      if (snap.snapshotMeta?.treeTruncated) {
        summary += ' GitHub tree response was truncated — only part of the repository was enumerated.';
      }
      return {
        summary,
        overallScore: snap.overallScore,
        issues: snap.issues,
        positives: snap.positives,
      };
    } catch (e) {
      logger.warn(`Snapshot repository analysis unavailable (${e.message}) — falling back to diff heuristics.`);
    }
  }

  const diff = String(diffText || '').trim();

  if (!diff) {
    return {
      summary:
        '[analysis] Snapshot scan failed or credentials were insufficient, and GitHub returned no textual diff for this commit. Verify repo access tokens, branch history, or pick another commit SHA.',
      overallScore: null,
      issues: [],
      positives: [],
    };
  }

  let raw = await runLocalAnalysis(diff, repoContext);
  raw = augmentAnalysisFromDiff(raw, diff);
  return raw;
}

function getReviewAiRuntimeInfo() {
  return {
    mode: 'repository_snapshot_rules',
    usesOpenAiApi: false,
    hint:
      'Reviews scan up to hundreds of tracked .js/.ts/.vue paths at your commit snapshot (Git tree + blobs) with weighted static checks; fallback uses diff-only heuristics.',
  };
}

module.exports = { analyzeCode, getReviewAiRuntimeInfo };
