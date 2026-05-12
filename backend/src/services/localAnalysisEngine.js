'use strict';

const { logger } = require('../utils/logger');
const { iterateAddedLines, clipSnippet } = require('../lib/diffParseUtils');

/**
 * Zero-cost local code review — pattern scan on unified diff additions only.
 * Matches finalizeReview expectation: summary, overallScore, issues[], positives[]
 */

const SECRET_REGEX =
  /\bsk_live_\S{10,}|sk-ant-api\d*|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|xox[bap]-[A-Za-z0-9-]+|-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i;

/** ENV-style literals: JWT_SECRET = "...", API_KEY='x', etc. */
const JWT_OR_ENV_LITERAL =
  /\b[A-Z][A-Z0-9]*_(?:SECRET|KEY|TOKEN|PASSWORD)\s*=\s*['"][^'"\\]{3,512}['"]/i;

const ASYNC_ARROW_OR_FUNC = /\basync\s*(?:function\s*\w*\s*\(|\([^)]*\)\s*=>)|async\s+function\b/;

const TODO_REGEX = /\b(TODO|FIXME|HACK|XXX)\b/i;

const RULE = {
  CONSOLE_LOG: {
    slug: 'pattern_console_log',
    matchedRuleLabel: /console\.(log|debug|info)/i.source,
    test: (t) => /console\.(log|debug|info)\s*\(/i.test(t),
  },
  TODO_MARKER: {
    slug: 'pattern_todo_fixme',
    matchedRuleLabel: String(TODO_REGEX.source),
    test: (t) => TODO_REGEX.test(t),
  },
  SECRET_LITERAL: {
    slug: 'pattern_secret_material',
    matchedRuleLabel: `${SECRET_REGEX.source} OR ${JWT_OR_ENV_LITERAL.source}`,
    test: (t) => SECRET_REGEX.test(t) || JWT_OR_ENV_LITERAL.test(t),
  },
  ASYNC_NO_CATCH: {
    slug: 'pattern_async_await_without_catch',
    matchedRuleLabel: 'new async/await in the patch, but no try/catch or .catch together with it',
    test: () => false,
  },
  LONG_ADDED_BLOCK: {
    slug: 'pattern_long_added_block',
    matchedRuleLabel: '24 or more new lines in a row in the same file',
    test: () => false,
  },
  NO_PATTERN_FALLBACK: {
    slug: 'pattern_scan_no_strong_hit',
    matchedRuleLabel: 'none of our simple pattern checks fired on these new lines',
    test: () => false,
  },
  MINIMAL_DIFF_FALLBACK: {
    slug: 'pattern_minimal_diff',
    matchedRuleLabel: 'almost nothing new was added in the diff text',
    test: () => false,
  },
};

function findLongAddedRuns(addedRows) {
  const byFile = new Map();
  for (const r of addedRows) {
    const list = byFile.get(r.filePath) || [];
    list.push(r);
    byFile.set(r.filePath, list);
  }

  const runs = [];

  byFile.forEach((rows, filePath) => {
    rows.sort((a, b) => (a.lineNumber || 0) - (b.lineNumber || 0));
    if (!rows.length) return;
    let start = rows[0].lineNumber ?? 0;
    let prev = rows[0].lineNumber ?? 0;
    let count = 1;
    let sliceRows = [rows[0]];

    const flushRun = () => {
      if (count >= 24) runs.push({ filePath, start, height: count, snippetRows: sliceRows.slice() });
    };

    for (let i = 1; i < rows.length; i += 1) {
      const ln = rows[i].lineNumber ?? 0;
      if (ln === prev + 1) {
        count += 1;
        prev = ln;
        sliceRows.push(rows[i]);
      } else {
        flushRun();
        start = ln;
        prev = ln;
        count = 1;
        sliceRows = [rows[i]];
      }
    }
    flushRun();
  });

  return runs;
}

function asyncWithoutCatchSignals(addedRows) {
  const byFile = new Map();
  for (const r of addedRows) {
    const list = byFile.get(r.filePath) || [];
    list.push(r);
    byFile.set(r.filePath, list);
  }

  const hits = [];

  byFile.forEach((rows, fp) => {
    const merged = rows.map((x) => x.text).join('\n');
    if (!ASYNC_ARROW_OR_FUNC.test(merged)) return;
    if (/\.catch\s*\(|catch\s*\(/.test(merged)) return;
    if (!/\bawait\b/.test(merged)) return;
    const firstAsync = rows.find((r) => ASYNC_ARROW_OR_FUNC.test(r.text));
    if (firstAsync) hits.push({ filePath: fp, lineNumber: firstAsync.lineNumber, snippet: firstAsync.text });
  });

  return hits;
}

function dedupeIssues(list) {
  const seen = new Set();
  const out = [];
  for (const i of list) {
    const slug = i.matchedRuleSlug || i.title;
    const key = `${i.filePath}:${i.lineNumber ?? 'x'}:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(i);
  }
  return out;
}

/**
 * @returns {Promise<{summary:string,overallScore:number,issues:object[],positives:string[]}>}
 */
async function analyzeCode(diffText, repoContext = {}) {
  const repo = repoContext.repoName ? String(repoContext.repoName).slice(0, 120) : 'repository';
  const added = iterateAddedLines(diffText);
  const positives = [];

  if (added.length > 5) positives.push('Meaningful change volume in diff — good iteration cadence.');
  positives.push(
    'Zero-budget local analyzer (pattern heuristics) — not a cloud LLM. Safe for thesis demos without API spend.'
  );

  const issues = [];
  const mergedBlob = added.map((a) => a.text).join('\n');
  let score = 88;

  const bumpDown = (n) => {
    score = Math.max(28, score - n);
  };

  for (const row of added) {
    const { filePath, lineNumber: ln, text: t } = row;
    const snippet = clipSnippet(t);

    if (RULE.CONSOLE_LOG.test(t)) {
      issues.push({
        filePath,
        lineNumber: ln,
        codeSnippet: snippet,
        matchedRuleSlug: RULE.CONSOLE_LOG.slug,
        matchedRule: 'This new line calls console.log, console.debug, or console.info',
        severity: 'info',
        category: 'maintainability',
        title: 'console.log (or debug / info) in new code',
        description:
          'Usually fine while developing; in production it can clutter logs and sometimes print private data.',
        suggestion: 'Remove or replace with real logging you can turn off in production.',
      });
      bumpDown(2);
    }

    if (RULE.TODO_MARKER.test(t)) {
      issues.push({
        filePath,
        lineNumber: ln,
        codeSnippet: snippet,
        matchedRuleSlug: RULE.TODO_MARKER.slug,
        matchedRule: 'The new line contains TODO, FIXME, HACK, or XXX',
        severity: 'suggestion',
        category: 'maintainability',
        title: 'TODO / FIXME in new code',
        description: 'A note that work is unfinished.',
        suggestion: 'Track it in your task system or finish it before a big release.',
      });
      bumpDown(1);
    }

    if (RULE.SECRET_LITERAL.test(t)) {
      issues.push({
        filePath,
        lineNumber: ln,
        codeSnippet: snippet,
        matchedRuleSlug: RULE.SECRET_LITERAL.slug,
        matchedRule:
          'Looks like a key, token, private key block, or JWT_SECRET=… style line in the new code',
        severity: 'critical',
        category: 'security',
        title: 'Possible secret in new code',
        description:
          'This added line may contain a real secret. Do not keep real secrets in the repo.',
        suggestion: 'Use env vars or a secret store. Rotate the key if it was real.',
      });
      bumpDown(15);
    }
  }

  for (const h of asyncWithoutCatchSignals(added)) {
    issues.push({
      filePath: h.filePath,
      lineNumber: h.lineNumber,
      codeSnippet: clipSnippet(h.snippet || ''),
      matchedRuleSlug: RULE.ASYNC_NO_CATCH.slug,
      matchedRule: `What we checked in the new lines only: ${RULE.ASYNC_NO_CATCH.matchedRuleLabel}`,
      severity: 'warning',
      category: 'bug',
      title: 'New async code with no obvious error handling',
      description:
        'The patch adds async and await but does not show try/catch or .catch in those new lines.',
      suggestion: 'Use try/catch around await, or add .catch(…) on promises.',
    });
    bumpDown(8);
  }

  for (const run of findLongAddedRuns(added)) {
    const head = run.snippetRows?.slice(0, 5).map((r) => r.text.trim()) ?? [];
    const mergedSnip = head.join('\n');
    issues.push({
      filePath: run.filePath,
      lineNumber: run.start,
      codeSnippet: clipSnippet(mergedSnip || `(${run.height} consecutive added lines)`),
      matchedRuleSlug: RULE.LONG_ADDED_BLOCK.slug,
      matchedRule: RULE.LONG_ADDED_BLOCK.matchedRuleLabel,
      severity: 'warning',
      category: 'maintainability',
      title: 'Very long stretch of new code',
      description: `About ${run.height} new lines in a row in one place — harder to read and test.`,
      suggestion: 'Split into smaller functions or files when you can.',
    });
    bumpDown(5);
  }

  const substantial = mergedBlob.replace(/\s/g, '').length > 120;

  if (issues.length === 0 && substantial) {
    issues.push({
      filePath: added[0]?.filePath || 'mixed',
      lineNumber: added[0]?.lineNumber ?? null,
      codeSnippet: added[0] ? clipSnippet(added[0].text) : '',
      matchedRuleSlug: RULE.NO_PATTERN_FALLBACK.slug,
      matchedRule: RULE.NO_PATTERN_FALLBACK.matchedRuleLabel,
      severity: 'info',
      category: 'style',
      title: 'No simple red flags on these new lines',
      description:
        'We checked common smells (secrets, todos, huge blocks, etc.) but did not spot them here. Your team should still review by hand.',
      suggestion: 'Keep normal tests and code review.',
    });
  }

  if (issues.length === 0) {
    issues.push({
      filePath: added[0]?.filePath || 'patch',
      lineNumber: added[0]?.lineNumber ?? null,
      codeSnippet: added[0] ? clipSnippet(added[0].text) : '',
      matchedRuleSlug: RULE.MINIMAL_DIFF_FALLBACK.slug,
      matchedRule: RULE.MINIMAL_DIFF_FALLBACK.matchedRuleLabel,
      severity: 'info',
      category: 'maintainability',
      title: 'Tiny change in the diff',
      description:
        'GitHub only sent a very small chunk of new text, so there is little for the checker to look at.',
      suggestion:
        'After a bigger commit that changes real app code, run “Review latest” again.',
    });
  }

  const uniq = dedupeIssues(issues);
  /** One synthetic row only → not meaningful to show a headline number (users read it as a bug). */
  const onlyMinimal =
    uniq.length === 1 && uniq[0]?.matchedRuleSlug === RULE.MINIMAL_DIFF_FALLBACK.slug;

  let overallScore = Math.round(Math.min(100, Math.max(0, score)));
  let summary =
    uniq.length > 1 || (uniq.length === 1 && substantial)
      ? `${uniq.length} finding(s) from local pattern scan on ${repo} (free, heuristic only).`
      : `Review complete (${repo}) — local heuristic analyzer, no external AI cost.`;

  if (onlyMinimal) {
    overallScore = null;
    summary = `Almost nothing to analyse in this diff (${repo}) — numeric score omitted. Queue a review on a fuller commit after you push real code changes.`;
  }

  logger.info(`Local analysis: score=${overallScore ?? 'none'}, issues=${uniq.length}`);

  return {
    summary,
    overallScore,
    issues: uniq,
    positives,
  };
}

module.exports = { analyzeCode };
