const { isRemediationNoiseLine } = require('../lib/remediationMarkers');

describe('remediationMarkers', () => {
  it('ignores ai-fix and ai-review comment lines', () => {
    expect(isRemediationNoiseLine('// [ai-fix] console.log("x");')).toBe(true);
    expect(isRemediationNoiseLine('// [ai-review] Possible secret — use env vars')).toBe(true);
  });

  it('does not ignore normal source lines', () => {
    expect(isRemediationNoiseLine('const x = 1;')).toBe(false);
    expect(isRemediationNoiseLine('console.log("hi");')).toBe(false);
  });
});
