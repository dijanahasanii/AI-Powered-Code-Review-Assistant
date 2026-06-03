'use strict';

const {
  remediationStatusForIssueCount,
  normalizeReportRemediation,
} = require('../lib/reportRemediationStatus');

describe('reportRemediationStatus', () => {
  it('uses not_needed when there are zero issues', () => {
    expect(remediationStatusForIssueCount(0)).toBe('not_needed');
    expect(remediationStatusForIssueCount(3)).toBe('pending');
  });

  it('normalizes legacy pending rows with zero issues', () => {
    const out = normalizeReportRemediation({
      issue_count: 0,
      remediation_status: 'pending',
    });
    expect(out.remediation_status).toBe('not_needed');
  });

  it('keeps pushed status when issue count is zero', () => {
    const out = normalizeReportRemediation({
      issue_count: 0,
      remediation_status: 'pushed',
    });
    expect(out.remediation_status).toBe('pushed');
  });
});
