'use strict';

const fs = require('fs/promises');
const path = require('path');
const { runStaticRulesOnFiles, capAndSortIssues } = require('../analyzers/staticRules');
const { computeScoreFromIssues } = require('../analyzers/computeScore');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out']);

async function collectSourceFilesUnder(rootDir, relativePrefix = '') {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const rel = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
    const abs = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectSourceFilesUnder(abs, rel)));
      continue;
    }
    if (!/\.(jsx?|mjs|cjs|tsx?|ts|vue)$/i.test(entry.name)) continue;
    try {
      const content = await fs.readFile(abs, 'utf8');
      out.push({ filePath: rel.replace(/\\/g, '/'), content });
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

function scanSourceFiles(files) {
  const issues = capAndSortIssues(runStaticRulesOnFiles(files));
  const count = issues.length;
  const score = count === 0 ? 100 : computeScoreFromIssues(issues);
  return { count, score, issues };
}

/** Map analyzer issue shape → review_issues-like rows for targetedFixService */
function issuesToFixRows(issues) {
  return (issues || []).map((i) => ({
    file_path: i.filePath,
    line_number: i.lineNumber,
    title: i.title,
    category: i.category,
    description: i.description,
    suggestion: i.suggestion,
    matched_rule: i.matchedRuleSlug ? `${i.matchedRuleSlug}::${i.matchedRule || ''}` : i.matchedRule,
  }));
}

async function scanRepoDirectory(repoDir) {
  const files = await collectSourceFilesUnder(repoDir);
  return scanSourceFiles(files);
}

function scanFileMap(fileMap) {
  const files = [...fileMap.entries()].map(([filePath, content]) => ({ filePath, content }));
  return scanSourceFiles(files);
}

/**
 * @param {number} baselineCount
 * @param {number|null} baselineScore
 * @param {{ count: number, score: number }} candidate
 */
function isRegressionAgainstBaseline(baselineCount, baselineScore, candidate) {
  if (
    baselineCount != null &&
    candidate.count != null &&
    Number(candidate.count) > Number(baselineCount)
  ) {
    return true;
  }
  if (
    baselineScore != null &&
    candidate.score != null &&
    Number(candidate.score) < Number(baselineScore)
  ) {
    return true;
  }
  return false;
}

module.exports = {
  collectSourceFilesUnder,
  scanRepoDirectory,
  scanFileMap,
  issuesToFixRows,
  isRegressionAgainstBaseline,
};
