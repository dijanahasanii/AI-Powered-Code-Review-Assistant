'use strict';

/** Shown when confirm-remediation or the job runner is invoked while auto-remediation is off. */
const AUTO_REMEDIATION_DISABLED_MESSAGE =
  'Auto-remediation is disabled on this server. Set ENABLE_AUTO_REMEDIATION=true in the backend environment to enable clone, fix, and push.';

/**
 * High-risk pipeline (git clone, npm exec, push) — opt-in only.
 * Default: false (unset or any value other than true/1/on/yes).
 * @returns {boolean}
 */
function isAutoRemediationEnabled() {
  const raw = String(process.env.ENABLE_AUTO_REMEDIATION ?? '').trim().toLowerCase();
  return ['true', '1', 'on', 'yes'].includes(raw);
}

module.exports = {
  isAutoRemediationEnabled,
  AUTO_REMEDIATION_DISABLED_MESSAGE,
};
