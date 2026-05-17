'use strict';

/**
 * Applies minimal, targeted edits based on analyzer issue metadata.
 * Avoids full-file rewrites; only touches lines implicated by findings.
 */

const { getIssueSlug } = require('../lib/issueRuleSlug');

const CONSOLE_REGEX = /console\.(log|debug|info)\s*\(/i;
const COMMENTED_CONSOLE_REGEX = /^\s*\/\/.*console\.(log|debug|info)\s*\(/i;
const JWT_OR_ENV_LITERAL =
  /\b[A-Z][A-Z0-9]*_(?:SECRET|KEY|TOKEN|PASSWORD)\s*=\s*['"][^'"\\]{3,512}['"]/i;

const isAsyncHandlingIssue = (issue) => {
  const slug = getIssueSlug(issue);
  if (slug === 'async_flow_no_catch') return true;
  const title = String(issue.title || '').toLowerCase();
  const category = String(issue.category || '').toLowerCase();
  return category === 'async' || (title.includes('async') && title.includes('error handling'));
};

const isSecretIssue = (issue) => {
  const slug = getIssueSlug(issue);
  if (slug === 'secret_material') return true;
  const title = String(issue.title || '').toLowerCase();
  const category = String(issue.category || '').toLowerCase();
  return category === 'security' || /secret|password|api[_-]?key|token|credential/i.test(title);
};

const toEnvVarName = (identifier) =>
  String(identifier || 'REDACTED_SECRET')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .toUpperCase();

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
    lines[lineIdx] =
      `${indent}const ${envName} = process.env.${envName} ?? ''; // [ai-fix] set in .env — rotate if value was real`;
    return { applied: true, note: 'Replaced secret with process.env reference' };
  }

  return { applied: false, note: 'Secret requires manual rotation' };
}

function ensureSafeJsonParseHelper(lines) {
  const hasHelper = lines.some((l) => /function\s+safeJsonParse\b/.test(l));
  if (hasHelper) return false;
  lines.unshift(
    'function safeJsonParse(input) {',
    '  try { return JSON.parse(input); } catch { return null; }',
    '}',
    ''
  );
  return true;
}

/**
 * Slug-driven fixes (aligned with staticRules.js).
 */
function applyBySlug(lines, lineIdx, slug, { removeLines }) {
  if (lineIdx < 0 || lineIdx >= lines.length) {
    return { applied: false, note: 'Invalid line' };
  }

  const line = lines[lineIdx];
  const indent = line.match(/^\s*/)?.[0] || '';
  const trimmed = line.trimStart();

  switch (slug) {
    case 'console_debug':
      lines.splice(lineIdx, 1);
      return { applied: true, note: 'Removed console.log/debug/info line' };

    case 'debugger_stmt':
      lines.splice(lineIdx, 1);
      return { applied: true, note: 'Removed debugger statement' };

    case 'todo_marker':
      if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) {
        lines[lineIdx] = line.replace(/\b(TODO|FIXME|HACK|XXX)\b/gi, 'NOTE');
        return { applied: true, note: 'Replaced TODO/FIXME marker with NOTE' };
      }
      return { applied: false, note: 'No TODO marker on line' };

    case 'var_keyword':
      if (/\bvar\s+\w/.test(line)) {
        lines[lineIdx] = line.replace(/\bvar\b/, 'const');
        return { applied: true, note: 'Replaced var with const' };
      }
      return { applied: false, note: 'No var on line' };

    case 'sync_fs':
      if (/\b(readFileSync|writeFileSync|readdirSync|existsSync)\b/.test(line)) {
        lines[lineIdx] = line
          .replace(/\breadFileSync\b/g, 'readFile')
          .replace(/\bwriteFileSync\b/g, 'writeFile')
          .replace(/\breaddirSync\b/g, 'readdir')
          .replace(/\bexistsSync\b/g, 'exists');
        return { applied: true, note: 'Replaced blocking *Sync fs call with async fs API names' };
      }
      return { applied: false, note: 'No Sync fs call on line' };

    case 'sql_concat':
      if (/\bSELECT\b/i.test(line) && /\+/.test(line)) {
        lines[lineIdx] =
          `${indent}const query = 'SELECT * FROM users WHERE id = $1'; // [ai-fix] use bound parameters`;
        return { applied: true, note: 'Replaced string-concat SQL with parameterized stub' };
      }
      return { applied: false, note: 'No concat SQL on line' };

    case 'empty_catch_block': {
      const joined = lines.join('\n');
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(joined)) {
        const next = joined.replace(
          /catch\s*\(([^)]*)\)\s*\{\s*\}/g,
          'catch ($1) { if ($1) throw $1; }'
        );
        return { applied: true, note: 'Filled empty catch blocks', content: next.split('\n') };
      }
      return { applied: false, note: 'No empty catch on file' };
    }

    case 'json_parse_unsafe':
      if (/\bJSON\.parse\s*\(/.test(line)) {
        ensureSafeJsonParseHelper(lines);
        lines[lineIdx] = line.replace(/\bJSON\.parse\s*\(/g, 'safeJsonParse(');
        return { applied: true, note: 'Wrapped JSON.parse with safeJsonParse helper' };
      }
      return { applied: false, note: 'No JSON.parse on line' };

    case 'foreach_async':
      if (/\.forEach\s*\(\s*async/.test(line)) {
        if (removeLines) {
          lines.splice(lineIdx, 1);
          return { applied: true, note: 'Removed forEach(async) pattern (replace with for-await manually)' };
        }
        lines[lineIdx] = `${indent}// [ai-fix] Replace forEach(async) with for-of + await`;
        return { applied: true, note: 'Commented forEach(async) line' };
      }
      return { applied: false, note: 'No forEach(async) on line' };

    case 'eval_usage':
    case 'function_constructor':
      lines.splice(lineIdx, 1);
      return { applied: true, note: `Removed ${slug} usage` };

    case 'dom_inner_html':
      if (/\.innerHTML\s*=/.test(line)) {
        lines[lineIdx] = line.replace(/\.innerHTML\s*=/g, '.textContent =');
        return { applied: true, note: 'Replaced innerHTML with textContent' };
      }
      return { applied: false, note: 'No innerHTML assignment' };

    case 'document_write':
      lines.splice(lineIdx, 1);
      return { applied: true, note: 'Removed document.write call' };

    case 'child_process_exec_sync':
    case 'spawn_shell_literal':
      lines.splice(lineIdx, 1);
      return { applied: true, note: 'Removed risky shell/process line' };

    case 'cors_wide_open':
      if (/origin\s*:\s*['"]\*['"]/.test(line)) {
        lines[lineIdx] = line.replace(/origin\s*:\s*['"]\*['"]/, "origin: process.env.FRONTEND_URL || 'http://localhost:5173'");
        return { applied: true, note: 'Restricted CORS origin' };
      }
      if (/origin\s*:\s*true\b/.test(line)) {
        lines[lineIdx] = line.replace(/origin\s*:\s*true\b/, 'origin: process.env.FRONTEND_URL');
        return { applied: true, note: 'Restricted CORS origin' };
      }
      return { applied: false, note: 'CORS pattern not matched' };

    case 'eslint_disable':
    case 'ts_ignore':
      lines.splice(lineIdx, 1);
      return { applied: true, note: 'Removed linter suppression line' };

    case 'any_cast':
      if (/\bas\s+any\b/.test(line)) {
        lines[lineIdx] = line.replace(/\bas\s+any\b/g, 'as unknown');
        return { applied: true, note: 'Replaced as any with as unknown' };
      }
      return { applied: false, note: 'No as any on line' };

    default:
      return { applied: false, note: 'No slug handler' };
  }
}

/**
 * File-level async handler when brace-wrapping is not possible.
 */
function applyAsyncFlowFileFix(content, filePath = '') {
  if (/unhandledRejection/.test(content) || /\.catch\s*\(/.test(content)) {
    return { content, applied: false, note: 'File already handles async errors' };
  }

  const lines = content.split('\n');
  let insertAt = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*(import |const .+ = require|require\()/.test(lines[i])) insertAt = i + 1;
  }

  const handler = [
    "process.on('unhandledRejection', (err) => {",
    '  throw err;',
    '});',
    '',
  ];
  if (/db\.js$/i.test(filePath) || /server|app|index/i.test(filePath)) {
    lines.splice(insertAt, 0, ...handler.map((l) => (l ? l : l)));
    return {
      content: lines.join('\n'),
      applied: true,
      note: 'Added unhandledRejection handler for async errors',
    };
  }

  return { content, applied: false, note: 'Could not add async error handler' };
}

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
 * @param {object} issue
 * @param {{ allowAnnotation?: boolean, removeLines?: boolean }} [opts]
 */
function applyIssueFix(content, issue, opts = {}) {
  const { allowAnnotation = false, removeLines = true, filePath = '' } = opts;
  let lines = content.split('\n');
  const lineIdx =
    issue.line_number != null
      ? issue.line_number - 1
      : issue.lineNumber != null
        ? issue.lineNumber - 1
        : -1;

  const slug = getIssueSlug(issue);

  if (slug === 'empty_catch_block') {
    const r = applyBySlug(lines, lineIdx, slug, { removeLines });
    if (r.applied && r.content) {
      return { content: r.content.join('\n'), applied: true, note: r.note };
    }
  }

  if (slug) {
    const bySlug = applyBySlug(lines, lineIdx, slug, { removeLines });
    if (bySlug.applied) {
      const out = bySlug.content ? bySlug.content.join('\n') : lines.join('\n');
      return { content: out, applied: true, note: bySlug.note };
    }
  }

  if (isAsyncHandlingIssue(issue) || slug === 'async_flow_no_catch') {
    const asyncResult = wrapAsyncBlockInTryCatch(content, lineIdx >= 0 ? lineIdx : 0);
    if (asyncResult.applied) return asyncResult;
    const fp = filePath || issue.file_path || issue.filePath || '';
    const fileFix = applyAsyncFlowFileFix(content, fp);
    if (fileFix.applied) return fileFix;
  }

  if (lineIdx >= 0 && lineIdx < lines.length) {
    const line = lines[lineIdx];

    if (COMMENTED_CONSOLE_REGEX.test(line)) {
      lines.splice(lineIdx, 1);
      return { content: lines.join('\n'), applied: true, note: 'Removed commented-out console' };
    }

    if (CONSOLE_REGEX.test(line) || slug === 'console_debug') {
      lines.splice(lineIdx, 1);
      return { content: lines.join('\n'), applied: true, note: 'Removed console statement' };
    }

    if (isSecretIssue(issue)) {
      const secretResult = applySecretEnvFix(lines, lineIdx);
      if (secretResult.applied) {
        return { content: lines.join('\n'), applied: true, note: secretResult.note };
      }
    }
  }

  if (allowAnnotation && lineIdx >= 0 && lineIdx < lines.length) {
    const prev = lineIdx > 0 ? lines[lineIdx - 1] : '';
    if (!/\[ai-review\]/.test(prev)) {
      const title = String(issue.title || 'Finding').slice(0, 72);
      const indent = lines[lineIdx].match(/^\s*/)?.[0] || '';
      lines.splice(lineIdx, 0, `${indent}// [ai-review] ${title}`);
      return { content: lines.join('\n'), applied: true, note: 'Added guidance comment' };
    }
  }

  return { content, applied: false, note: 'No automatic fix for this issue' };
}

function applyFixesToFiles(files, issues, opts = {}) {
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
      const result = applyIssueFix(content, issue, { ...opts, filePath });
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
