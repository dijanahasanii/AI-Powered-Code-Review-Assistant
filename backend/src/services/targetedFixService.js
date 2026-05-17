'use strict';

/**
 * Applies minimal, targeted edits based on analyzer issue metadata.
 * Avoids full-file rewrites; only touches lines implicated by findings.
 */

const CONSOLE_REGEX = /console\.(log|debug|info)\s*\(/i;
const COMMENTED_CONSOLE_REGEX = /^\s*\/\/.*console\.(log|debug|info)\s*\(/i;
const JWT_OR_ENV_LITERAL =
  /\b[A-Z][A-Z0-9]*_(?:SECRET|KEY|TOKEN|PASSWORD)\s*=\s*['"][^'"\\]{3,512}['"]/i;

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

const isSecretIssue = (issue) => {
  const title = String(issue.title || '').toLowerCase();
  const rule = String(issue.matched_rule || issue.matchedRule || '').toLowerCase();
  const category = String(issue.category || '').toLowerCase();
  return (
    category === 'security' ||
    /secret|password|api[_-]?key|token|credential/i.test(title + rule)
  );
};

const toEnvVarName = (identifier) =>
  String(identifier || 'REDACTED_SECRET')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .toUpperCase();

/**
 * Replace obvious inline secrets with process.env references (user must set .env).
 */
function applySecretEnvFix(lines, lineIdx) {
  const line = lines[lineIdx];

  const jwtMatch = line.match(
    /^(\s*)(\b[A-Z][A-Z0-9]*_(?:SECRET|KEY|TOKEN|PASSWORD))\s*=\s*['"][^'"]+['"]\s*;?\s*$/
  );
  if (jwtMatch) {
    lines[lineIdx] = `${jwtMatch[1]}${jwtMatch[2]} = process.env.${jwtMatch[2]} ?? ''; // [ai-fix]`;
    return { applied: true, note: 'Replaced env-style secret with process.env reference' };
  }

  const varAssign = line.match(
    /^(\s*)(?:const|let|var)\s+(\w+)\s*=\s*['"]([^'"]{4,})['"]\s*;?\s*$/
  );
  if (varAssign && /secret|password|key|token|credential/i.test(varAssign[2] + line)) {
    const envName = toEnvVarName(varAssign[2]);
    lines[lineIdx] =
      `${varAssign[1]}const ${varAssign[2]} = process.env.${envName} ?? ''; // [ai-fix] configure in .env`;
    return { applied: true, note: 'Replaced literal credential with process.env reference' };
  }

  const propAssign = line.match(/^(\s*)([\w$]+)\s*:\s*['"]([^'"]{4,})['"]\s*,?\s*$/);
  if (propAssign && /secret|password|key|token|credential/i.test(propAssign[2] + line)) {
    const envName = toEnvVarName(propAssign[2]);
    const trailingComma = /,\s*$/.test(line) ? ',' : '';
    lines[lineIdx] = `${propAssign[1]}${propAssign[2]}: process.env.${envName} ?? ''${trailingComma} // [ai-fix]`;
    return { applied: true, note: 'Replaced property secret with process.env reference' };
  }

  if (JWT_OR_ENV_LITERAL.test(line) || /['"`][^'"`]{8,}['"`]/.test(line)) {
    const indent = line.match(/^\s*/)?.[0] || '';
    const envName = toEnvVarName(line.match(/\b(\w+)\b/)?.[1] || 'APP_SECRET');
    lines[lineIdx] = `${indent}// [ai-fix] Move secret to process.env.${envName} — see analyzer suggestion`;
    lines.splice(lineIdx + 1, 0, `${indent}// [ai-fix] (original line commented out — rotate credential if it was real)`);
    lines.splice(lineIdx + 2, 0, `${indent}// ${line.trim()}`);
    return { applied: true, note: 'Commented secret line and added env-var guidance' };
  }

  return { applied: false, note: 'Secret-like value requires manual rotation — not auto-modified' };
}

/**
 * @param {string[]} lines
 * @param {number} lineIdx
 * @param {object} issue
 */
function applySuggestionAnnotation(lines, lineIdx, issue) {
  if (lineIdx < 0 || lineIdx >= lines.length) {
    return { applied: false, note: 'Invalid line for annotation' };
  }

  const prev = lineIdx > 0 ? lines[lineIdx - 1] : '';
  if (/\[ai-review\]|\[ai-fix\]/.test(prev)) {
    return { applied: false, note: 'Annotation already present above line' };
  }

  const title = String(issue.title || 'Analyzer finding').replace(/\s+/g, ' ').slice(0, 72);
  const hint = String(issue.suggestion || issue.description || '')
    .replace(/\s+/g, ' ')
    .slice(0, 140);
  const indent = lines[lineIdx].match(/^\s*/)?.[0] || '';
  const comment = hint
    ? `${indent}// [ai-review] ${title} — ${hint}`
    : `${indent}// [ai-review] ${title}`;

  lines.splice(lineIdx, 0, comment);
  return { applied: true, note: 'Added analyzer guidance comment above line' };
}

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
  for (let i = Math.max(0, startLineIdx); i < lines.length; i += 1) {
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
  for (let i = openLine; i < lines.length; i += 1) {
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
 * @param {{ allowAnnotation?: boolean }} [opts]
 * @returns {{ content: string, applied: boolean, note: string }}
 */
function applyIssueFix(content, issue, opts = {}) {
  const { allowAnnotation = true } = opts;
  const lines = content.split('\n');
  const lineIdx =
    issue.line_number != null
      ? issue.line_number - 1
      : issue.lineNumber != null
        ? issue.lineNumber - 1
        : -1;
  const rule = String(issue.matched_rule || issue.matchedRule || '').toLowerCase();
  const title = String(issue.title || '').toLowerCase();
  const suggestion = String(issue.suggestion || '');

  if (isAsyncHandlingIssue(issue)) {
    const asyncResult = wrapAsyncBlockInTryCatch(content, lineIdx >= 0 ? lineIdx : 0);
    if (asyncResult.applied) return asyncResult;
  }

  if (lineIdx >= 0 && lineIdx < lines.length) {
    const line = lines[lineIdx];
    const trimmed = line.trimStart();

    if (COMMENTED_CONSOLE_REGEX.test(line)) {
      lines.splice(lineIdx, 1);
      return {
        content: lines.join('\n'),
        applied: true,
        note: 'Removed commented-out console statement',
      };
    }

    if (CONSOLE_REGEX.test(line) || rule.includes('console.log') || title.includes('console')) {
      if (trimmed.startsWith('//')) {
        lines.splice(lineIdx, 1);
        return {
          content: lines.join('\n'),
          applied: true,
          note: 'Removed commented-out console statement',
        };
      }
      const indent = line.slice(0, line.length - trimmed.length);
      lines[lineIdx] = `${indent}// [ai-fix] ${trimmed}`;
      return { content: lines.join('\n'), applied: true, note: 'Commented console statement' };
    }

    if (/todo|fixme|hack|xxx/i.test(line) && (rule.includes('todo') || title.includes('todo'))) {
      if (!trimmed.startsWith('//')) {
        const indent = line.slice(0, line.length - trimmed.length);
        lines[lineIdx] = `${indent}// [ai-fix] tracked: ${trimmed}`;
        return { content: lines.join('\n'), applied: true, note: 'Annotated TODO marker' };
      }
    }

    if (isSecretIssue(issue)) {
      const secretResult = applySecretEnvFix(lines, lineIdx);
      if (secretResult.applied) {
        return { content: lines.join('\n'), applied: true, note: secretResult.note };
      }
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

  if (allowAnnotation && lineIdx >= 0 && lineIdx < lines.length) {
    const ann = applySuggestionAnnotation(lines, lineIdx, issue);
    if (ann.applied) {
      return { content: lines.join('\n'), applied: true, note: ann.note };
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
    const sorted = [...fileIssues].sort(
      (a, b) => (b.line_number ?? b.lineNumber ?? 0) - (a.line_number ?? a.lineNumber ?? 0)
    );

    for (const issue of sorted) {
      const result = applyIssueFix(content, issue, { allowAnnotation: true });
      content = result.content;
      if (result.applied) {
        applied.push({ filePath, note: result.note });
      } else {
        skipped.push({ filePath, note: result.note });
      }
    }

    if (content !== working.get(filePath)) {
      working.set(filePath, content);
    }
  }

  return { files: working, applied, skipped };
}

module.exports = { applyIssueFix, applyFixesToFiles };
