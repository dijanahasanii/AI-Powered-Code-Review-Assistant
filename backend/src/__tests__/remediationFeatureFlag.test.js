const {
  isAutoRemediationEnabled,
  AUTO_REMEDIATION_DISABLED_MESSAGE,
} = require('../lib/remediationFeatureFlag');

describe('remediationFeatureFlag', () => {
  const prev = process.env.ENABLE_AUTO_REMEDIATION;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.ENABLE_AUTO_REMEDIATION;
    } else {
      process.env.ENABLE_AUTO_REMEDIATION = prev;
    }
  });

  it('defaults to disabled when unset', () => {
    delete process.env.ENABLE_AUTO_REMEDIATION;
    expect(isAutoRemediationEnabled()).toBe(false);
  });

  it('defaults to disabled for false-like values', () => {
    process.env.ENABLE_AUTO_REMEDIATION = 'false';
    expect(isAutoRemediationEnabled()).toBe(false);
    process.env.ENABLE_AUTO_REMEDIATION = '0';
    expect(isAutoRemediationEnabled()).toBe(false);
  });

  it('enables only for explicit true-like values', () => {
    for (const v of ['true', '1', 'on', 'yes']) {
      process.env.ENABLE_AUTO_REMEDIATION = v;
      expect(isAutoRemediationEnabled()).toBe(true);
    }
  });

  it('exposes a stable disabled message', () => {
    expect(AUTO_REMEDIATION_DISABLED_MESSAGE).toMatch(/ENABLE_AUTO_REMEDIATION=true/i);
  });
});
