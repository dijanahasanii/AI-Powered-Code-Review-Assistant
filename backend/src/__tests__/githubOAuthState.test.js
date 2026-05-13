'use strict';

describe('githubOAuthState', () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    jest.useRealTimers();
  });

  it('round-trips: created state verifies until expiry window', () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-for-jest-suite';
    const { createGithubOAuthState, verifyGithubOAuthState } = require('../utils/githubOAuthState');
    const state = createGithubOAuthState();
    expect(typeof state).toBe('string');
    expect(state.split('.').length).toBe(3);
    expect(verifyGithubOAuthState(state)).toBe(true);
  });

  it('rejects tampered signature', () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-for-jest-suite';
    const { createGithubOAuthState, verifyGithubOAuthState } = require('../utils/githubOAuthState');
    const state = createGithubOAuthState();
    const parts = state.split('.');
    parts[2] = 'tampered';
    expect(verifyGithubOAuthState(parts.join('.'))).toBe(false);
  });

  it('rejects after max age', () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-for-jest-suite';
    jest.useFakeTimers({ now: 1_700_000_000_000 });
    const { createGithubOAuthState, verifyGithubOAuthState, STATE_MAX_AGE_MS } = require('../utils/githubOAuthState');
    const state = createGithubOAuthState();
    jest.advanceTimersByTime(STATE_MAX_AGE_MS + 1);
    expect(verifyGithubOAuthState(state)).toBe(false);
  });

  it('rejects missing JWT_SECRET', () => {
    delete process.env.JWT_SECRET;
    const { createGithubOAuthState, verifyGithubOAuthState } = require('../utils/githubOAuthState');
    expect(() => createGithubOAuthState()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'x'.repeat(32);
    const ok = createGithubOAuthState();
    delete process.env.JWT_SECRET;
    expect(verifyGithubOAuthState(ok)).toBe(false);
  });

  it('rejects empty or non-string state', () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-for-jest-suite';
    const { verifyGithubOAuthState } = require('../utils/githubOAuthState');
    expect(verifyGithubOAuthState('')).toBe(false);
    expect(verifyGithubOAuthState(null)).toBe(false);
    expect(verifyGithubOAuthState('a.b')).toBe(false);
  });
});
