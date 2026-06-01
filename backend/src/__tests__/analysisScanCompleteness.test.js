'use strict';

const {
  isSnapshotMetaComplete,
  isAnalysisScanComplete,
} = require('../analyzers/analysisScanCompleteness');

describe('analysisScanCompleteness', () => {
  it('marks complete when tree is full and all eligible blobs were attempted', () => {
    expect(
      isSnapshotMetaComplete({
        treeTruncated: false,
        blobsEligible: 10,
        blobsAttempted: 10,
        fetchErrors: 0,
      })
    ).toBe(true);
  });

  it('marks incomplete when tree truncated (Scenario E)', () => {
    expect(
      isSnapshotMetaComplete({
        treeTruncated: true,
        blobsEligible: 500,
        blobsAttempted: 420,
        fetchErrors: 0,
      })
    ).toBe(false);
  });

  it('marks incomplete when file cap prevents scanning all eligible blobs', () => {
    expect(
      isSnapshotMetaComplete({
        treeTruncated: false,
        blobsEligible: 500,
        blobsAttempted: 420,
        fetchErrors: 0,
      })
    ).toBe(false);
  });

  it('requires explicit scanComplete on analysis result', () => {
    expect(isAnalysisScanComplete({ scanComplete: true })).toBe(true);
    expect(isAnalysisScanComplete({ scanComplete: false })).toBe(false);
    expect(isAnalysisScanComplete({})).toBe(false);
  });
});
