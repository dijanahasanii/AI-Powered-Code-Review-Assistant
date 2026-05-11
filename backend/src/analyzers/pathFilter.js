'use strict';

/** Max bytes per file before we skip (GitHub blobs + decode buffer guard). */
const MAX_FILE_BYTES = 320_000;

const ALLOW_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.vue']);

/**
 * Snapshot tree: skip our own rule-engine sources. They literally contain regexes and
 * example strings for "bad" code, so static rules fire on data lines -> self-scan noise
 * and an unfairly low score when reviewing this repository.
 * (Diff-only review of real edits to these files is unchanged — only Git tree blob pick skips them.)
 */
const RULE_ENGINE_SOURCE_SUFFIXES = [
  '/analyzers/staticRules.js',
  '/services/localAnalysisEngine.js',
  '/services/diffHeuristicAudit.js',
  '/scripts/sync-ngrok-url.js',
];

function isRuleEngineDefinitionPath(repoPath) {
  if (!repoPath || typeof repoPath !== 'string') return false;
  const n = repoPath.replace(/\\/g, '/');
  return RULE_ENGINE_SOURCE_SUFFIXES.some((suf) => n.endsWith(suf));
}

const IGNORE_SEGMENT = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '.nuxt',
  'storybook-static',
  '__pycache__',
  '.venv',
  'venv',
  'vendor',
  'target',
  'Pods',
  '.gradle',
  'bower_components',
  '.turbo',
  '.parcel-cache',
]);

function shouldScanPath(repoPath, sizeBytes) {
  if (!repoPath || typeof repoPath !== 'string') return false;
  if (repoPath.length > 240) return false;

  const lower = repoPath.toLowerCase();
  const parts = repoPath.split('/');

  const base = parts[parts.length - 1] || '';
  if (base.startsWith('.') && base !== '.eslintrc.js') return false;

  for (const seg of parts) {
    if (IGNORE_SEGMENT.has(seg)) return false;
  }

  if (/\.(min|bundle)\.(js|mjs|cjs)$/i.test(lower)) return false;
  if (/\.d\.ts$/.test(lower)) return false;
  if (/\.(map|lock|snap)$/i.test(lower)) return false;

  const dot = repoPath.lastIndexOf('.');
  const ext = dot >= 0 ? repoPath.slice(dot) : '';
  if (!ALLOW_EXTENSIONS.has(ext)) return false;

  if (sizeBytes != null && Number(sizeBytes) > MAX_FILE_BYTES) return false;

  if (isRuleEngineDefinitionPath(repoPath)) return false;

  return true;
}

module.exports = {
  MAX_FILE_BYTES,
  shouldScanPath,
  isRuleEngineDefinitionPath,
  ALLOW_EXTENSIONS,
};
