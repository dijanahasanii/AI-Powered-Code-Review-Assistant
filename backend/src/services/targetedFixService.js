'use strict';

/**
 * Applies minimal, targeted edits based on analyzer issue metadata.
 * Avoids full-file rewrites; only touches lines implicated by findings.
 */

const CONSOLE_REGEX = /console\.(log|debug|info)\s*\(/;

const isAsyncHandlingIssue = (issue) => {
  const title = String(issue.title || '').toLowerCase();
  const rule = String(issue.matched_rule || issue.matchedRule || '').toLowerCase();
  const category = String(issue.category || '').toLowerCase();
  return (
    category === 'async' ||
    title.includes('async') ||
    title.includes('error handling') ||
    rule.includes('async') ||
    rule.includes('catch')
  );
};

/**
 * Wrap async function body (from first `{` after start line) in try/catch.
 * @param {string} content
 * @param {number} startLineIdx - 0-based line where async was flagged
 */
function wrapAsyncBlockInTryCatch(content, startLineIdx) {
  const lines = content.split('\n');
  if (/\bcatch\s*\(/.test(content) || /\.catch\s*\(/.test(content)) {
    return { content, applied: false, note: 'File already has catch handling' };
  }

  let openLine = -1;
  for (let i = Math.max(0, startLineIdx); i < lines.length; i++) {
    if (lines[i].includes('{')) {
      openLine = i;
      break;
    }
  }
  if (openLine < 0) {
    return { content, applied: false, note: 'No block brace found near async code' };
  }

  let depth = 0;
  let closeLine = -1;
  for (let i = openLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          closeLine = i;
          break;
        }
      }
    }
    if (closeLine >= 0) break;
  }

  if (closeLine <= openLine) {
    return { content, applied: false, note: 'Could not match async block braces' };
  }

  const baseIndent = lines[openLine].match(/^\s*/)?.[0] || '';
  const innerIndent = `${baseIndent}  `;
  const bodyLines = lines.slice(openLine + 1, closeLine);

  const next = [
    ...lines.slice(0, openLine + 1),
    `${innerIndent}try {`,
    ...bodyLines,
    `${innerIndent}} catch (error) {`,
    `${innerIndent}  console.error('[ai-fix] async error:', error);`,
    `${innerIndent}  throw error;`,
    `${innerIndent}}`,
    ...lines.slice(closeLine + 1),
  ];

  return {
    content: next.join('\n'),
    applied: true,
    note: 'Wrapped async block in try/catch',
  };
}

/**
 * @param {string} content
 * @param {object} issue - DB row or analyzer issue shape
 * @returns {{ content: string, applied: boolean, note: string }}
 */
function applyIssueFix(content, issue) {
  const lines = content.split('\n');
  const lineIdx = issue.line_number != null ? issue.line_number - 1 : issue.lineNumber != null ? issue.lineNumber - 1 : -1;
  const rule = String(issue.matched_rule || issue.matchedRule || '').toLowerCase();
  const title = String(issue.title || '').toLowerCase();
  const suggestion = String(issue.suggestion || '');

  if (isAsyncHandlingIssue(issue)) {
    const asyncResult = wrapAsyncBlockInTryCatch(content, lineIdx >= 0 ? lineIdx : 0);
    if (asyncResult.applied) return asyncResult;
  }

  if (lineIdx >= 0 && lineIdx < lines.length) {
    const line = lines[lineIdx];

    if (CONSOLE_REGEX.test(line) || rule.includes('console.log') || title.includes('console')) {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//')) {
        return { content, applied: false, note: 'Line already commented' };
      }
      const indent = line.slice(0, line.length - trimmed.length);
      lines[lineIdx] = `${indent}// [ai-fix] ${trimmed}`;
      return { content: lines.join('\n'), applied: true, note: 'Commented console statement' };
    }

    if (/todo|fixme|hack|xxx/i.test(line) && (rule.includes('todo') || title.includes('todo'))) {
      const trimmed = line.trimStart();
      if (!trimmed.startsWith('//')) {
        const indent = line.slice(0, line.length - trimmed.length);
        lines[lineIdx] = `${indent}// [ai-fix] tracked: ${trimmed}`;
        return { content: lines.join('\n'), applied: true, note: 'Annotated TODO marker' };
      }
    }

    if (/secret|password|api[_-]?key|token/i.test(title + rule) && /['"`][^'"`]{8,}['"`]/.test(line)) {
      return {
        content,
        applied: false,
        note: 'Secret-like value requires manual rotation — not auto-modified',
      };
    }
  }

  if (suggestion && lineIdx >= 0 && lineIdx < lines.length) {
    const line = lines[lineIdx];
    const suggestLower = suggestion.toLowerCase();
    if (suggestLower.includes('remove') && suggestLower.includes('console') && CONSOLE_REGEX.test(line)) {
      const indent = line.match(/^\s*/)?.[0] || '';
      lines[lineIdx] = `${indent}// [ai-fix] removed per analyzer suggestion`;
      return { content: lines.join('\n'), applied: true, note: 'Removed console per suggestion' };
    }
  }

  return { content, applied: false, note: 'No safe automatic fix for this issue' };
}

/**
 * @param {Map<string, string>} files - path -> content
 * @param {object[]} issues
 * @returns {{ files: Map<string, string>, applied: { filePath: string, note: string }[], skipped: { filePath: string, note: string }[] }}
 */
function applyFixesToFiles(files, issues) {
  const applied = [];
  const skipped = [];
  const working = new Map(files);

  const byFile = issues.reduce((acc, issue) => {
    const fp = issue.file_path || issue.filePath;
    if (!fp) return acc;
    if (!acc[fp]) acc[fp] = [];
    acc[fp].push(issue);
    return acc;
  }, {});

  for (const [filePath, fileIssues] of Object.entries(byFile)) {
    if (!working.has(filePath)) {
      skipped.push({ filePath, note: 'File not in working set' });
      continue;
    }
    let content = working.get(filePath);
    let anyApplied = false;
    for (const issue of fileIssues) {
      const result = applyIssueFix(content, issue);
      content = result.content;
      if (result.applied) {
        anyApplied = true;
        applied.push({ filePath, note: result.note });
      } else {
        skipped.push({ filePath, note: result.note });
      }
    }
    if (anyApplied) {
      working.set(filePath, content);
    }
  }

  return { files: working, applied, skipped };
}

module.exports = { applyIssueFix, applyFixesToFiles };
