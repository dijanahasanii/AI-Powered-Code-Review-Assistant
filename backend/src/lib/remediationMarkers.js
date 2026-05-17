'use strict';

/**
 * Lines produced by Apply-fixes automation — exclude from analyzer so re-scans do not
 * count our own comments/patches as new findings.
 */
function isRemediationNoiseLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return false;
  if (/\[ai-fix\]|\[ai-review\]/i.test(trimmed)) return true;
  if (/^\s*\/\//.test(trimmed) && /console\.(log|debug|info)\s*\(/i.test(trimmed)) return true;
  if (/console\.error\s*\(\s*['"]\[ai-fix\]/i.test(trimmed)) return true;
  return false;
}

module.exports = { isRemediationNoiseLine };
