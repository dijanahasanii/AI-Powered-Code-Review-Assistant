'use strict';

/**
 * Resolve static-rule slug from a review_issues row or analyzer issue object.
 */
function getIssueSlug(issue) {
  const mr = String(issue.matched_rule || issue.matchedRule || '');
  const prefixed = mr.match(/^([a-z][a-z0-9_]*)::/i);
  if (prefixed) return prefixed[1].toLowerCase();

  const slug = String(issue.matched_rule_slug || issue.matchedRuleSlug || '').toLowerCase();
  if (slug) return slug;

  const title = String(issue.title || '').toLowerCase();
  const rule = mr.toLowerCase();

  if (/console\.(log|debug|info)/i.test(rule) || title.includes('console')) return 'console_debug';
  if (title.includes('secret') || title.includes('password') || title.includes('api key')) {
    return 'secret_material';
  }
  if (title.includes('todo') || title.includes('fixme')) return 'todo_marker';
  if (title.includes('debugger')) return 'debugger_stmt';
  if (title.includes('readfilesync') || title.includes('blocking')) return 'sync_fs';
  if (title.includes('sql') && (title.includes('string') || title.includes('gluing'))) return 'sql_concat';
  if (title.includes('empty catch')) return 'empty_catch_block';
  if (
    title.includes('async') &&
    (title.includes('error handling') || title.includes('missing error'))
  ) {
    return 'async_flow_no_catch';
  }
  if (title.includes('blocking') && title.includes('file')) return 'sync_fs';
  if (title.includes('json.parse')) return 'json_parse_unsafe';
  if (title.includes('foreach') && title.includes('async')) return 'foreach_async';
  if (title.includes('uses var')) return 'var_keyword';
  if (title.includes('eval')) return 'eval_usage';
  if (title.includes('innerhtml')) return 'dom_inner_html';
  if (title.includes('dangerously')) return 'dangerously_inner_html_react';

  return null;
}

function formatMatchedRuleForStorage(issue) {
  const slug = issue.matchedRuleSlug || issue.matched_rule_slug;
  const label = issue.matchedRule || issue.matched_rule || '';
  if (slug && label) return `${slug}::${label}`;
  if (slug) return `${slug}::`;
  return label || null;
}

module.exports = { getIssueSlug, formatMatchedRuleForStorage };
