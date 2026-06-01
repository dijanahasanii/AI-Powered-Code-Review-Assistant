'use strict';

const {
  buildRepositorySummary,
  alignSummaryWithTrackedIssues,
} = require('../analyzers/buildSummary');

describe('alignSummaryWithTrackedIssues', () => {
  const rawSummary = buildRepositorySummary(
    'org/repo',
    'abc1234',
    {
      issues: Array.from({ length: 53 }, (_, i) => ({
        filePath: `src/f${i}.js`,
        severity: i % 2 === 0 ? 'critical' : 'warning',
        category: 'security',
        title: 'Issue',
      })),
      linesScanned: 1200,
      filesScanned: 40,
    },
    { treeTruncated: false, skippedTooLarge: 0 }
  );

  it('replaces raw "We reported N items" with active tracked counts', () => {
    const active = Array.from({ length: 19 }, (_, i) => ({
      filePath: `src/a${i}.js`,
      severity: 'warning',
      category: 'security',
      title: 'T',
    }));
    const out = alignSummaryWithTrackedIssues(rawSummary, active, { resolvedThisRunCount: 19 });
    expect(out).toContain('We have 19 active findings after issue tracking');
    expect(out).not.toMatch(/We reported 53 items/);
    expect(out).toContain('19 issues were marked resolved in this review');
    expect(out).toContain('we opened 40 code files');
  });

  it('uses zero-active wording when no open issues remain', () => {
    const out = alignSummaryWithTrackedIssues(rawSummary, [], { resolvedThisRunCount: 5 });
    expect(out).toContain('No active findings remain after issue tracking');
    expect(out).not.toMatch(/We reported 53/);
  });
});
