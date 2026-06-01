'use strict';

function countBySeverity(issues) {
  return issues.reduce((acc, i) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1;
    return acc;
  }, {});
}

function countByCategory(issues) {
  return issues.reduce((acc, i) => {
    const k = i.category || 'maintainability';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function topFilePaths(issues, n = 5) {
  const m = {};
  for (const i of issues) {
    const p = i.filePath;
    if (!p) continue;
    m[p] = (m[p] || 0) + 1;
  }
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([path, count]) => `${path} (${count})`);
}

function buildRepositorySummary(repoName, commitShort, stats, meta) {
  const { issues, linesScanned, filesScanned } = stats;
  const sev = countBySeverity(issues);
  const cat = countByCategory(issues);
  const tops = topFilePaths(issues, 6);

  const catTop = Object.entries(cat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${k.replace(/-/g, ' ')}: ${v}`)
    .join('; ');

  const parts = [
    `${repoName}, commit ${commitShort}: we opened ${filesScanned} code files and read about ${linesScanned.toLocaleString()} lines (skipping folders like node_modules and build output).`,
    `We reported ${issues.length} items — ${sev.critical || 0} serious, ${sev.warning || 0} worth fixing soon, ${sev.info || 0} FYI, ${sev.suggestion || 0} small cleanups.`,
  ];

  if (catTop) parts.push(`Most findings types: ${catTop}.`);
  if (tops.length) parts.push(`Files with the most flags: ${tops.join('; ')}.`);

  if (meta.treeTruncated) {
    parts.push('GitHub cut off part of the file list for this huge repo, so the scan may miss some files.');
  }
  if (meta.skippedTooLarge) {
    parts.push(`${meta.skippedTooLarge} files were too big to download and were skipped.`);
  }

  return parts.join(' ');
}

/**
 * Replace raw analyzer finding counts with active tracked-issue counts (post sync).
 * Keeps scan coverage sentences; rebuilds category / top-file hints from active issues only.
 * @param {string} originalSummary
 * @param {object[]} activeIssues
 * @param {{ resolvedThisRunCount?: number }} [opts]
 * @returns {string}
 */
function alignSummaryWithTrackedIssues(originalSummary, activeIssues, opts = {}) {
  const resolvedThisRunCount = Number(opts.resolvedThisRunCount) || 0;
  const issues = activeIssues || [];
  const sev = countBySeverity(issues);
  const n = issues.length;

  let trackedLine;
  if (n === 0) {
    trackedLine =
      'No active findings remain after issue tracking across reviews for this repository.';
  } else {
    trackedLine = `We have ${n} active finding${n !== 1 ? 's' : ''} after issue tracking — ${sev.critical || 0} serious, ${sev.warning || 0} worth fixing soon, ${sev.info || 0} FYI, ${sev.suggestion || 0} small cleanups.`;
  }
  if (resolvedThisRunCount > 0) {
    trackedLine += ` ${resolvedThisRunCount} issue${resolvedThisRunCount !== 1 ? 's were' : ' was'} marked resolved in this review.`;
  }

  let body = String(originalSummary || '').trim();
  if (!body) return trackedLine;

  const replacedReported = body.replace(/We reported \d+ items[^.]*\./, `${trackedLine}.`);
  const replacedLocal = replacedReported.replace(
    /\d+ finding\(s\) from local pattern scan[^.]*\./,
    `${trackedLine}.`
  );
  body = replacedLocal;

  if (!body.includes('after issue tracking') && !body.includes('No active findings remain')) {
    const firstDot = body.indexOf('. ');
    if (firstDot !== -1) {
      body = `${body.slice(0, firstDot + 1)} ${trackedLine}.${body.slice(firstDot + 1)}`;
    } else {
      body = `${body} ${trackedLine}.`;
    }
  }

  body = body.replace(/ Most findings types:[^.]*\./g, '');
  body = body.replace(/ Files with the most flags:[^.]*\./g, '');

  if (n > 0) {
    const cat = countByCategory(issues);
    const catTop = Object.entries(cat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, v]) => `${k.replace(/-/g, ' ')}: ${v}`)
      .join('; ');
    const tops = topFilePaths(issues, 6);
    if (catTop) body += ` Most findings types: ${catTop}.`;
    if (tops.length) body += ` Files with the most flags: ${tops.join('; ')}.`;
  }

  return body.trim();
}

module.exports = { buildRepositorySummary, alignSummaryWithTrackedIssues, countBySeverity };
