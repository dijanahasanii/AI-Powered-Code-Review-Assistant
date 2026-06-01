'use strict';

/**
 * Whether a repository scan enumerated all eligible source files (safe to auto-resolve missing issues).
 * @param {object} [meta] snapshotMeta from fetchRepoSourceFilesAtCommit
 * @returns {boolean}
 */
function isSnapshotMetaComplete(meta) {
  if (!meta || typeof meta !== 'object') return false;
  if (meta.treeTruncated) return false;
  const eligible = Number(meta.blobsEligible) || 0;
  const attempted = Number(meta.blobsAttempted) || 0;
  if (eligible > attempted) return false;
  if ((Number(meta.fetchErrors) || 0) > 0) return false;
  return true;
}

/**
 * @param {object} analysis analyzeCode() result
 * @returns {boolean}
 */
function isAnalysisScanComplete(analysis) {
  return analysis?.scanComplete === true;
}

module.exports = {
  isSnapshotMetaComplete,
  isAnalysisScanComplete,
};
