'use strict';

/**
 * Weighted deductions from 100. Diminishing curve so huge issue lists don't floor to 0 instantly.
 */
const SEVERITY_WEIGHT = {
  critical: 16,
  warning: 6.5,
  info: 2.2,
  suggestion: 1,
};

const MAX_RAW_PENALTY = 78;

function computeScoreFromIssues(issues) {
  if (!issues.length) return 100;

  let raw = 0;
  for (const i of issues) {
    const w = SEVERITY_WEIGHT[i.severity];
    if (typeof w === 'number') raw += w;
  }

  const damped = Math.min(MAX_RAW_PENALTY, raw + Math.max(0, issues.length - 35) * 0.35);
  return Math.round(Math.max(0, Math.min(100, 100 - damped)));
}

module.exports = { computeScoreFromIssues, SEVERITY_WEIGHT };
