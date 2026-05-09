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

module.exports = { buildRepositorySummary };
