'use strict';

const {
  buildIssueFingerprint,
  buildLegacyIssueFingerprint,
  dedupeIssuesByFingerprint,
} = require('../analyzers/issueFingerprint');

describe('issueFingerprint', () => {
  const base = {
    filePath: 'src/utils.js',
    category: 'security',
    severity: 'critical',
    matchedRuleSlug: 'secret-literal',
    title: 'Possible hardcoded secret',
  };

  it('is stable for the same logical finding', () => {
    const a = buildIssueFingerprint(base);
    const b = buildIssueFingerprint({ ...base, lineNumber: 10 });
    const c = buildIssueFingerprint({ ...base, lineNumber: 42 });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('does not change when only severity changes (Scenario D)', () => {
    const a = buildIssueFingerprint(base);
    const b = buildIssueFingerprint({ ...base, severity: 'warning' });
    expect(a).toBe(b);
    expect(buildLegacyIssueFingerprint(base)).not.toBe(a);
  });

  it('changes when file, category, or rule identity changes', () => {
    const a = buildIssueFingerprint(base);
    expect(buildIssueFingerprint({ ...base, filePath: 'src/other.js' })).not.toBe(a);
    expect(buildIssueFingerprint({ ...base, category: 'performance' })).not.toBe(a);
    expect(buildIssueFingerprint({ ...base, matchedRuleSlug: 'console-log' })).not.toBe(a);
  });

  it('dedupes issues by fingerprint', () => {
    const issues = [
      base,
      { ...base, lineNumber: 99, severity: 'warning' },
      { ...base, filePath: 'src/other.js' },
    ];
    const out = dedupeIssuesByFingerprint(issues);
    expect(out).toHaveLength(2);
    expect(out[0].fingerprint).toBeDefined();
  });
});
