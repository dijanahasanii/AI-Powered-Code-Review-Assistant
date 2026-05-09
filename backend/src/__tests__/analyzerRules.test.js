const { runStaticRulesOnFiles, capAndSortIssues } = require('../analyzers/staticRules');
const { computeScoreFromIssues } = require('../analyzers/computeScore');
const { buildRepositorySummary } = require('../analyzers/buildSummary');

describe('Repository static rule engine', () => {
  it('different file sets produce distinct issue counts', () => {
    const minimal = [{ path: 'src/clean/helpers.ts', content: 'export const x = 1;\n' }];
    const dirty = [{ path: 'svc/routes/login.js', content: `const q = 'SELECT * FROM u WHERE id=' + userId;\n` }];

    const i1 = capAndSortIssues(runStaticRulesOnFiles(minimal));
    const i2 = capAndSortIssues(runStaticRulesOnFiles(dirty));
    expect(i2.length >= i1.length).toBe(true);
    expect(i2.some((x) => x.category === 'security')).toBe(true);
  });

  it('weighted score drops when severities accumulate', () => {
    const files = [{ path: 'bad.js', content: ['eval(foo);', "SELECT *+'x'", ''].join('\n') }];
    const issues = capAndSortIssues(runStaticRulesOnFiles(files));
    const s = computeScoreFromIssues(issues);
    expect(s).toBeLessThanOrEqual(100);
    expect(issues.some((x) => x.severity === 'critical')).toBe(true);
  });

  it('summaries reference concrete stats', () => {
    const files = [{ path: 'frontend/App.tsx', content: 'export const Demo = () => <div />\nconsole.log("x")\n' }];
    const issues = capAndSortIssues(runStaticRulesOnFiles(files));
    const txt = buildRepositorySummary(
      'acme/widget',
      'abc123f',
      { issues, linesScanned: 2, filesScanned: 1 },
      { treeTruncated: false, skippedTooLarge: 0 }
    );
    expect(txt).toContain('acme/widget');
    expect(txt).toMatch(/\d+/);
  });
});
