'use strict';

/**
 * Cheap static signals on unified diff additions. Complements local analysis when
 * obvious smells should still be surfaced with line + snippet context.
 */

const { iterateAddedLines, clipSnippet } = require('../lib/diffParseUtils');

const normalizePath = (p) => String(p || '').replace(/^\s*/, '').trim();

function aiAlreadyMentions(filePath, aiIssues, terms) {
  const path = normalizePath(filePath);
  const blob = aiIssues
    .filter((i) => normalizePath(i.filePath) === path)
    .map((i) => `${i.title} ${i.description} ${i.matchedRule || ''}`.toLowerCase())
    .join('\n');
  return terms.some((t) => blob.includes(t));
}

const RULES = [
  {
    id: 'hardcoded_secret',
    matchedRule:
      'Text that looks like an API key, token, AWS key, password=…, or similar',
    severity: 'critical',
    category: 'security',
    title: 'Possible secret pasted in the new code',
    description:
      'This new line looks like a real key or password. Those should not live in git.',
    suggestion:
      'Move it to environment variables or a secret store. If it was real, rotate it.',
    testLine: (t) =>
      /\bsk_live_\S{12,}|\bsk_test-\S{10,}|AKIA[0-9A-Z]{16}\b|ADMIN_API_KEY\s*=|password\s*[:=]\s*['"][^'"]{6,}['"]/i.test(
        t
      ),
    dedupeTerms: ['secret', 'hardcoded', 'credential', 'api key', 'password'],
  },
  {
    id: 'sql_concat',
    matchedRule:
      'SELECT plus string + with words like user/password on the same line',
    severity: 'critical',
    category: 'security',
    title: 'SQL glued together with +',
    description:
      'Building SQL by joining strings is unsafe if any piece comes from a user (SQL injection).',
    suggestion:
      'Use your database library’s parameters instead of pasting values into the query string.',
    testLine: (t) =>
      /\bSELECT\b/i.test(t) &&
      /\+/.test(t) &&
      /username|password|userId|login|account/i.test(t),
    dedupeTerms: ['sql', 'injection', 'concatenat', 'query'],
  },
  {
    id: 'open_redirect',
    matchedRule: 'redirect or “next” URL built with + or `${…}`',
    severity: 'warning',
    category: 'security',
    title: 'Redirect link built from pieces',
    description:
      'If the user can influence the URL, they may send people to a scam site after login.',
    suggestion:
      'Only allow redirects to URLs you trust (fixed list), not anything the user types.',
    testLine: (t) =>
      (/\bnext\b/i.test(t) || /\bredirect/i.test(t)) &&
      (/\+\s*\w+|['"]?\s*\+\s*\w+|`\$\{/.test(t)),
    dedupeTerms: ['redirect', 'open redirect', 'url'],
  },
  {
    id: 'json_parse_unsafe',
    matchedRule: 'This new line calls JSON.parse(',
    severity: 'warning',
    category: 'bug',
    title: 'JSON.parse on new code',
    description:
      'Bad JSON will throw. If nothing catches it, the request or page can break.',
    suggestion: 'Use try/catch or check the string first.',
    testLine: (t) => /\bJSON\.parse\s*\(/.test(t),
    dedupeTerms: ['json', 'parse', 'try/catch'],
  },
  {
    id: 'eval',
    matchedRule: 'This new line calls eval(',
    severity: 'critical',
    category: 'security',
    title: 'eval() in new code',
    description: 'eval runs text as code. Anyone who controls that text can run anything.',
    suggestion: 'Remove eval. Use JSON.parse with checks, config files, or normal functions.',
    testLine: (t) => /\beval\s*\(/.test(t),
    dedupeTerms: ['eval'],
  },
];

function deriveHeuristicIssues(diffText, aiIssues = []) {
  const rows = iterateAddedLines(diffText);
  const out = [];
  const seen = new Set();

  for (const row of rows) {
    const { filePath, lineNumber: ln, text: t } = row;
    for (const rule of RULES) {
      if (!rule.testLine(t)) continue;
      if (aiAlreadyMentions(filePath, aiIssues, rule.dedupeTerms)) continue;
      const key = `${filePath}:${ln}:${rule.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        filePath,
        lineNumber: ln,
        codeSnippet: clipSnippet(t),
        matchedRuleSlug: rule.id,
        matchedRule: `What we checked on the new line: ${rule.matchedRule}`,
        severity: rule.severity,
        category: rule.category,
        title: rule.title,
        description: rule.description,
        suggestion: rule.suggestion,
      });
    }
  }

  return out;
}

/** Caps score only from *heuristic* rows so we don't re-punish issues the primary engine already counted. */
function penalizeScoreForHeuristicFindings(aiScore, heuristicIssues) {
  const base = typeof aiScore === 'number' && !Number.isNaN(aiScore) ? aiScore : 95;
  const crit = heuristicIssues.filter((i) => i.severity === 'critical').length;
  const warn = heuristicIssues.filter((i) => i.severity === 'warning').length;
  let ceiling = 96 - crit * 24 - warn * 10;
  ceiling = Math.max(22, ceiling);
  return Math.max(18, Math.min(base, Math.round(ceiling)));
}

/**
 * Merge deterministic findings with the model output and prevent “100/100” when
 * static checks still see clear problems.
 */
function augmentAnalysisFromDiff(analysis, diffText) {
  if (!analysis || typeof analysis !== 'object') return analysis;

  const aiIssues = Array.isArray(analysis.issues) ? analysis.issues : [];
  const extra = deriveHeuristicIssues(diffText, aiIssues);
  if (extra.length === 0) return analysis;

  const merged = [...aiIssues, ...extra];
  const nextScore = penalizeScoreForHeuristicFindings(analysis.overallScore, extra);

  return {
    ...analysis,
    issues: merged,
    overallScore: nextScore,
    summary: `${analysis.summary || ''} The diff-only pass also reported ${extra.length} more finding(s).`.trim(),
  };
}

module.exports = {
  augmentAnalysisFromDiff,
  deriveHeuristicIssues,
};
