'use strict';

const { computeScoreFromIssues } = require('../analyzers/computeScore');
const {
  buildIssueFingerprint,
  buildLegacyIssueFingerprint,
  dedupeIssuesByFingerprint,
} = require('../analyzers/issueFingerprint');
const repositoryIssuesRepository = require('../repositories/repositoryIssuesRepository');
const { withRepositoryIssueSyncLock } = require('../lib/repositorySyncMutex');
const { logger } = require('../utils/logger');

const STATUS_OPEN = 'open';
const STATUS_RESOLVED = 'resolved';
const STATUS_REOPENED = 'reopened';

/**
 * Map DB row → analyzer issue shape (for score + reports).
 */
function rowToIssueShape(row) {
  return {
    id: row.id,
    filePath: row.file_path,
    lineNumber: row.line_number,
    severity: row.severity,
    category: row.category,
    title: row.title,
    description: row.description,
    suggestion: row.suggestion,
    codeSnippet: row.code_snippet,
    matchedRule: row.matched_rule,
    matchedRuleSlug: row.matched_rule_slug || null,
    fingerprint: row.fingerprint,
    lifecycleStatus: row.status,
    repositoryIssueId: row.id,
  };
}

function rowFromDetection(issue) {
  return {
    file_path: issue.filePath,
    line_number: issue.lineNumber ?? null,
    severity: issue.severity,
    category: issue.category ?? null,
    title: issue.title,
    description: issue.description,
    suggestion: issue.suggestion ?? null,
    code_snippet: issue.codeSnippet ?? null,
    matched_rule: issue.matchedRule ?? issue.matched_rule ?? null,
    fingerprint: issue.fingerprint,
  };
}

/**
 * Recompute fingerprints after algorithm changes (e.g. severity removed from hash).
 */
async function reconcileRepositoryIssueFingerprints(repositoryId) {
  const { data: rows, error } = await repositoryIssuesRepository.listAllByRepositoryId(repositoryId);
  if (error) {
    throw new Error(`reconcileFingerprints: load failed: ${error.message}`);
  }

  for (const row of rows || []) {
    const shape = rowToIssueShape(row);
    const newFp = buildIssueFingerprint(shape);
    if (row.fingerprint === newFp) continue;

    const { data: conflict, error: cErr } =
      await repositoryIssuesRepository.listByRepositoryIdAndFingerprints(repositoryId, [newFp]);
    if (cErr) {
      logger.warn(`reconcileFingerprints: conflict check failed: ${cErr.message}`);
      continue;
    }
    if (conflict?.length && conflict[0].id !== row.id) {
      logger.warn(
        `reconcileFingerprints: skip ${row.id} — fingerprint ${newFp} collides with ${conflict[0].id}`
      );
      continue;
    }
    const { error: upErr } = await repositoryIssuesRepository.updateById(row.id, {
      fingerprint: newFp,
    });
    if (upErr) {
      logger.warn(`reconcileFingerprints: update ${row.id}: ${upErr.message}`);
    }
  }
}

function indexRowsByFingerprints(rows) {
  const map = new Map();
  for (const row of rows || []) {
    map.set(row.fingerprint, row);
    const shape = rowToIssueShape(row);
    const canonical = buildIssueFingerprint(shape);
    if (!map.has(canonical)) map.set(canonical, row);
    const legacy = buildLegacyIssueFingerprint(shape);
    if (!map.has(legacy)) map.set(legacy, row);
  }
  return map;
}

async function upsertDetectedIssue(repositoryId, reviewId, issue, existingByFp) {
  const fields = rowFromDetection(issue);
  let prev = existingByFp.get(issue.fingerprint);

  if (!prev) {
    const { error: insErr, data: inserted } = await repositoryIssuesRepository.insertRow({
      repository_id: repositoryId,
      ...fields,
      status: STATUS_OPEN,
      first_seen_review_id: reviewId,
      last_seen_review_id: reviewId,
    });

    if (!insErr && inserted) {
      existingByFp.set(issue.fingerprint, inserted);
      return;
    }

    if (insErr?.code === '23505') {
      const { data: existing } = await repositoryIssuesRepository.listByRepositoryIdAndFingerprints(
        repositoryId,
        [issue.fingerprint]
      );
      prev = existing?.[0];
      if (prev) existingByFp.set(issue.fingerprint, prev);
    } else if (insErr) {
      logger.warn(`Failed to insert tracked issue ${issue.fingerprint}: ${insErr.message}`);
      return;
    }
  }

  if (!prev) return;

  if (prev.status === STATUS_RESOLVED) {
    await repositoryIssuesRepository.updateById(prev.id, {
      ...fields,
      fingerprint: issue.fingerprint,
      status: STATUS_REOPENED,
      last_seen_review_id: reviewId,
      resolved_at: null,
      last_resolved_review_id: null,
    });
    return;
  }

  if (prev.status === STATUS_OPEN || prev.status === STATUS_REOPENED) {
    await repositoryIssuesRepository.updateById(prev.id, {
      ...fields,
      fingerprint: issue.fingerprint,
      status: prev.status === STATUS_OPEN ? STATUS_OPEN : STATUS_REOPENED,
      last_seen_review_id: reviewId,
    });
  }
}

/**
 * @param {object} opts
 * @param {boolean} opts.scanComplete
 */
async function syncRepositoryIssuesLocked(repositoryId, reviewId, detectedIssues, { scanComplete }) {
  await reconcileRepositoryIssueFingerprints(repositoryId);

  const detected = dedupeIssuesByFingerprint(detectedIssues || []);
  const detectedFpSet = new Set(detected.map((i) => i.fingerprint));

  const { data: activeRows, error: activeErr } =
    await repositoryIssuesRepository.listActiveByRepositoryId(repositoryId);
  if (activeErr) {
    throw new Error(`syncRepositoryIssues: load active failed: ${activeErr.message}`);
  }

  const resolvedThisRun = [];

  if (scanComplete) {
    for (const existing of activeRows || []) {
      const shape = rowToIssueShape(existing);
      const canonicalFp = buildIssueFingerprint(shape);
      if (detectedFpSet.has(existing.fingerprint) || detectedFpSet.has(canonicalFp)) continue;

      const { error: upErr } = await repositoryIssuesRepository.updateById(existing.id, {
        status: STATUS_RESOLVED,
        last_resolved_review_id: reviewId,
        resolved_at: new Date().toISOString(),
      });
      if (upErr) {
        logger.warn(`Failed to resolve issue ${existing.id}: ${upErr.message}`);
        continue;
      }
      resolvedThisRun.push(rowToIssueShape({ ...existing, status: STATUS_RESOLVED }));
    }
  } else {
    logger.info(
      `[issue-tracking] repo=${repositoryId} review=${reviewId} skip auto-resolve (incomplete scan)`
    );
  }

  const fps = [...new Set(detected.map((i) => i.fingerprint))];
  const { data: existingForFp, error: fpErr } =
    await repositoryIssuesRepository.listByRepositoryIdAndFingerprints(repositoryId, fps);
  if (fpErr) {
    throw new Error(`syncRepositoryIssues: load by fingerprint failed: ${fpErr.message}`);
  }

  const { data: activeForIndex } = await repositoryIssuesRepository.listActiveByRepositoryId(
    repositoryId
  );
  const existingByFp = indexRowsByFingerprints([...(existingForFp || []), ...(activeForIndex || [])]);

  for (const issue of detected) {
    await upsertDetectedIssue(repositoryId, reviewId, issue, existingByFp);
  }

  const { data: activeAfter, error: reloadErr } =
    await repositoryIssuesRepository.listActiveByRepositoryId(repositoryId);
  if (reloadErr) {
    throw new Error(`syncRepositoryIssues: reload active failed: ${reloadErr.message}`);
  }

  const activeIssues = (activeAfter || []).map(rowToIssueShape);
  const overallScore =
    activeIssues.length === 0 ? 100 : computeScoreFromIssues(activeIssues);

  logger.info(
    `[issue-tracking] repo=${repositoryId} review=${reviewId} scanComplete=${scanComplete} detected=${detected.length} active=${activeIssues.length} resolved_this_run=${resolvedThisRun.length} score=${overallScore}`
  );

  return {
    activeIssues,
    resolvedThisRun,
    overallScore,
    activeCount: activeIssues.length,
  };
}

/**
 * Sync detected issues with persistent repository_issues (serialized per repository).
 * @param {object} [opts]
 * @param {boolean} [opts.scanComplete=false]
 */
async function syncRepositoryIssues(repositoryId, reviewId, detectedIssues, opts = {}) {
  const scanComplete = opts.scanComplete === true;
  return withRepositoryIssueSyncLock(repositoryId, () =>
    syncRepositoryIssuesLocked(repositoryId, reviewId, detectedIssues, { scanComplete })
  );
}

module.exports = {
  STATUS_OPEN,
  STATUS_RESOLVED,
  STATUS_REOPENED,
  syncRepositoryIssues,
  syncRepositoryIssuesLocked,
  reconcileRepositoryIssueFingerprints,
  rowToIssueShape,
};
