const { isRegressionAgainstBaseline } = require('../services/remediationScan');

describe('remediationScan', () => {
  it('detects regression when issue count increases', () => {
    expect(isRegressionAgainstBaseline(3, 79, { count: 4, score: 78 })).toBe(true);
  });

  it('detects regression when score drops', () => {
    expect(isRegressionAgainstBaseline(3, 79, { count: 3, score: 78 })).toBe(true);
  });

  it('allows same or better results', () => {
    expect(isRegressionAgainstBaseline(3, 79, { count: 3, score: 79 })).toBe(false);
    expect(isRegressionAgainstBaseline(3, 79, { count: 2, score: 85 })).toBe(false);
  });
});
