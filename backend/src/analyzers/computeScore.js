'use strict';

/**
 * Weighted deductions from 100. Severity weights sum into a raw penalty;
 * volume adds a mild tail beyond the first N issues.
 *
 * Older versions used Math.min(MAX, raw+n) — any large repo flattened to the same
 * integer (e.g. 22). We use an asymptotic curve so heavier trees still separate.
 */
const SEVERITY_WEIGHT = {
  critical: 16,
  warning: 6.5,
  info: 2.2,
  suggestion: 1,
};

/** Soft ceiling — penalty approaches this as combined mass → ∞ */
const MAX_EFFECTIVE_PENALTY = 94;
/** Extra penalty per issue beyond the first VOLUME_TAIL_START issues */
const VOLUME_TAIL_PER_ISSUE = 0.35;
const VOLUME_TAIL_START = 35;
/** Higher = softer curve for the same raw sum */
const PENALTY_TAU = 100;

function computeScoreFromIssues(issues) {
  if (!issues.length) return 100;

  let raw = 0;
  for (const i of issues) {
    const w = SEVERITY_WEIGHT[i.severity];
    if (typeof w === 'number') raw += w;
  }

  const volumeBoost = Math.max(0, issues.length - VOLUME_TAIL_START) * VOLUME_TAIL_PER_ISSUE;
  const combined = raw + volumeBoost;

  const penalty = MAX_EFFECTIVE_PENALTY * (1 - Math.exp(-combined / PENALTY_TAU));
  return Math.round(Math.max(0, Math.min(100, 100 - penalty)));
}

module.exports = { computeScoreFromIssues, SEVERITY_WEIGHT };
