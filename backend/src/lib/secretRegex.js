'use strict';

/**
 * Secret-shaped diff patterns built without contiguous literals like `sk_live_` in source,
 * so tools such as gitleaks / Codacy do not false-positive on the detector itself.
 */
const skLive = [115, 107, 95, 108, 105, 118, 101, 95].map((c) => String.fromCharCode(c)).join('');
const skAnt = ['sk', 'ant', 'api'].join('-');
const akia = [65, 75, 73, 65].map((c) => String.fromCharCode(c)).join('');
const ghp = [103, 104, 112, 95].map((c) => String.fromCharCode(c)).join('');
const skTestDash = ['sk', 'test'].join('_') + '-';

/** Same semantics as legacy inline /…sk_live…|BEGIN…PRIVATE KEY…/i */
const SECRET_SHAPE = new RegExp(
  `\\b${skLive}\\S{10,}|${skAnt}\\d*|${akia}[0-9A-Z]{16}|${ghp}[A-Za-z0-9]{20,}|xox[bap]-[A-Za-z0-9-]+|\\x2d{5}BEGIN\\s+(RSA\\s+)?PRIVATE\\s+KEY\\x2d{5}`,
  'i'
);

/** diffHeuristicAudit: stripe-like + AWS + env password heuristics */
const SECRET_STRIPE_LIKE_LINE = new RegExp(
  `\\b${skLive}\\S{12,}|\\b${skTestDash}\\S{10,}|${akia}[0-9A-Z]{16}\\b|ADMIN_API_KEY\\s*=|password\\s*[:=]\\s*['"][^'"]{6,}['"]`,
  'i'
);

module.exports = { SECRET_SHAPE, SECRET_STRIPE_LIKE_LINE };
