const { shouldScanPath, isRuleEngineDefinitionPath } = require('../analyzers/pathFilter');

describe('pathFilter', () => {
  it('allows normal app paths', () => {
    expect(shouldScanPath('src/app.tsx', 100)).toBe(true);
    expect(shouldScanPath('backend/src/controllers/authController.js', 500)).toBe(true);
  });

  it('skips rule-engine definition files for snapshot scans (self-scan false positives)', () => {
    expect(isRuleEngineDefinitionPath('backend/src/analyzers/staticRules.js')).toBe(true);
    expect(isRuleEngineDefinitionPath('backend/src/services/localAnalysisEngine.js')).toBe(true);
    expect(isRuleEngineDefinitionPath('backend/scripts/sync-ngrok-url.js')).toBe(true);
    expect(shouldScanPath('backend/src/analyzers/staticRules.js', 1000)).toBe(false);
    expect(shouldScanPath('packages/x/backend/src/analyzers/staticRules.js', 100)).toBe(false);
  });

  it('does not skip unrelated files with similar folder names', () => {
    expect(shouldScanPath('backend/src/services/userService.js', 200)).toBe(true);
    expect(isRuleEngineDefinitionPath('backend/src/services/userService.js')).toBe(false);
  });
});
