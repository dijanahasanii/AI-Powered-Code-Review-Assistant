'use strict';

const crypto = require('crypto');

/**
 * Normalize file path for stable matching across runs.
 * @param {string} p
 */
function normalizeFilePath(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim()
    .toLowerCase();
}

/**
 * Stable rule identity for fingerprinting (severity is mutable metadata, not identity).
 * @param {object} issue
 */
function ruleKeyForFingerprint(issue) {
  const ruleSlug = String(issue.matchedRuleSlug || '').trim().toLowerCase();
  const matchedRule = String(issue.matchedRule || issue.matched_rule || '').trim().toLowerCase();
  const title = String(issue.title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return ruleSlug || matchedRule.slice(0, 160) || title.slice(0, 160);
}

/**
 * Deterministic fingerprint: file path + category + rule identity (no severity, no line).
 * @param {object} issue
 * @returns {string}
 */
function buildIssueFingerprint(issue) {
  const filePath = normalizeFilePath(issue.filePath || issue.file_path);
  const category = String(issue.category || 'general').trim().toLowerCase();
  const ruleKey = ruleKeyForFingerprint(issue);
  const payload = [filePath, category, ruleKey].join('\n');
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 40);
}

/**
 * Pre-fix fingerprint (included severity). Used only to reconcile rows written before severity was removed.
 * @param {object} issue
 * @returns {string}
 */
function buildLegacyIssueFingerprint(issue) {
  const filePath = normalizeFilePath(issue.filePath || issue.file_path);
  const category = String(issue.category || 'general').trim().toLowerCase();
  const severity = String(issue.severity || 'info').trim().toLowerCase();
  const ruleKey = ruleKeyForFingerprint(issue);
  const payload = [filePath, category, severity, ruleKey].join('\n');
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 40);
}

/**
 * Deduplicate detected issues by fingerprint (first wins).
 * @param {object[]} issues
 */
function dedupeIssuesByFingerprint(issues) {
  const seen = new Set();
  const out = [];
  for (const issue of issues || []) {
    const fp = buildIssueFingerprint(issue);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push({ ...issue, fingerprint: fp });
  }
  return out;
}

module.exports = {
  buildIssueFingerprint,
  buildLegacyIssueFingerprint,
  ruleKeyForFingerprint,
  dedupeIssuesByFingerprint,
  normalizeFilePath,
};
