import { describe, it, expect } from 'vitest';
import { getCompletedReviewsNewestFirst, repoHealthStatus } from './repoReviewStats';

describe('getCompletedReviewsNewestFirst', () => {
  it('sorts completed reviews newest first', () => {
    const repo = {
      code_reviews: [
        { status: 'completed', overall_score: 50, created_at: '2020-01-01T00:00:00Z' },
        { status: 'completed', overall_score: 90, created_at: '2024-06-01T00:00:00Z' },
        { status: 'pending', overall_score: 99, created_at: '2030-01-01T00:00:00Z' },
      ],
    };
    const ordered = getCompletedReviewsNewestFirst(repo);
    expect(ordered.map((r) => r.overall_score)).toEqual([90, 50]);
  });
});

describe('repoHealthStatus', () => {
  it('returns webhook when webhook is inactive', () => {
    const s = repoHealthStatus({
      webhook_active: false,
      code_reviews: [{ status: 'completed', overall_score: 95, created_at: '2024-01-01T00:00:00Z' }],
    });
    expect(s.key).toBe('webhook');
  });

  it('returns findings when latest completed score below 70', () => {
    const s = repoHealthStatus({
      webhook_active: true,
      code_reviews: [{ status: 'completed', overall_score: 60, created_at: '2024-01-01T00:00:00Z' }],
    });
    expect(s.key).toBe('findings');
  });

  it('returns healthy when latest score >= 90', () => {
    const s = repoHealthStatus({
      webhook_active: true,
      code_reviews: [{ status: 'completed', overall_score: 92, created_at: '2024-01-01T00:00:00Z' }],
    });
    expect(s.key).toBe('healthy');
  });

  it('returns synced when webhook on but no strong score band', () => {
    const s = repoHealthStatus({
      webhook_active: true,
      code_reviews: [{ status: 'completed', overall_score: 80, created_at: '2024-01-01T00:00:00Z' }],
    });
    expect(s.key).toBe('synced');
  });
});
