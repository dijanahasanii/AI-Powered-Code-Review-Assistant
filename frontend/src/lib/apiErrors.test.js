import { describe, it, expect, afterEach } from 'vitest';
import { describeApiFailure } from './apiErrors';

describe('describeApiFailure', () => {
  const origNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: origNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('uses offline copy when there is no response and navigator reports offline', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...origNavigator, onLine: false },
      configurable: true,
    });
    const err = new Error('Network Error');
    const r = describeApiFailure(err);
    expect(r.title).toBe('No internet connection detected.');
    expect(r.detail).toBe('Reconnect and try again.');
    expect(r.canRetry).toBe(true);
  });

  it('keeps generic network copy when online but server unreachable', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...origNavigator, onLine: true },
      configurable: true,
    });
    const err = new Error('Network Error');
    const r = describeApiFailure(err);
    expect(r.title).toBe('Network error');
    expect(r.detail).toMatch(/No response from the server/i);
  });

  it('maps axios timeout to a clear title', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...origNavigator, onLine: true },
      configurable: true,
    });
    const err = new Error('timeout of 15000ms exceeded');
    err.code = 'ECONNABORTED';
    const r = describeApiFailure(err);
    expect(r.title).toBe('Request timed out');
    expect(r.canRetry).toBe(true);
  });
});
