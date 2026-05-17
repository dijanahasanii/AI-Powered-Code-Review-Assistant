'use strict';

const { runStaticRulesOnFiles, capAndSortIssues } = require('../analyzers/staticRules');
const { applyFixesToFiles } = require('./targetedFixService');
const { scanFileMap, isRegressionAgainstBaseline } = require('./remediationScan');

const MAX_PASSES = 4;
const MAX_ISSUES_PER_PASS = 100;

/**
 * Re-scan patched files in memory and apply fixes until clean or no progress.
 * Never keeps a pass that increases issues or lowers score vs baseline.
 *
 * @param {Map<string, string>} fileMap
 * @param {string[]} logParts
 * @param {(parts: string[], line: string) => void} appendLog
 * @param {{ count: number, score: number|null }} baseline
 */
function polishFileMapUntilStable(fileMap, logParts, appendLog, baseline) {
  let best = new Map(fileMap);
  let bestMetrics = scanFileMap(best);

  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    const filesArr = [...best.entries()].map(([filePath, content]) => ({ filePath, content }));
    const remaining = capAndSortIssues(runStaticRulesOnFiles(filesArr)).slice(0, MAX_ISSUES_PER_PASS);

    if (!remaining.length) {
      appendLog(logParts, `Polish pass ${pass}: no remaining analyzer findings in patched files`);
      return best;
    }

    const dbIssues = remaining.map((i) => ({
      file_path: i.filePath,
      line_number: i.lineNumber,
      title: i.title,
      category: i.category,
      description: i.description,
      suggestion: i.suggestion,
      matched_rule: i.matchedRuleSlug ? `${i.matchedRuleSlug}::${i.matchedRule || ''}` : i.matchedRule,
    }));

    const { files: candidate, applied } = applyFixesToFiles(best, dbIssues, {
      allowAnnotation: false,
      removeLines: true,
    });

    appendLog(
      logParts,
      `Polish pass ${pass}: ${remaining.length} finding(s) targeted, ${applied.length} edit(s) applied`
    );

    if (applied.length === 0) break;

    const metrics = scanFileMap(candidate);
    if (isRegressionAgainstBaseline(baseline.count, baseline.score, metrics)) {
      appendLog(
        logParts,
        `Polish pass ${pass} stopped — would worsen results (${metrics.count} issues, score ${metrics.score}) vs before fixes (${baseline.count} issues, score ${baseline.score ?? '—'})`
      );
      break;
    }

    best = candidate;
    bestMetrics = metrics;
  }

  return best;
}

module.exports = { polishFileMapUntilStable };
