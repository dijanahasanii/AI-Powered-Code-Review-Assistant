import { describe, it, expect } from 'vitest';
import {
  reposListEnvelopeSchema,
  reviewsListEnvelopeSchema,
  statsEnvelopeSchema,
} from './schemas';

describe('api envelope schemas', () => {
  it('accepts typical stats payload', () => {
    const r = statsEnvelopeSchema.safeParse({
      success: true,
      data: { total: 1, completed: 1, pending: 0, processing: 0, avgScore: 80, issues: { critical: 2 } },
    });
    expect(r.success).toBe(true);
  });

  it('accepts repos list payload', () => {
    const r = reposListEnvelopeSchema.safeParse({
      success: true,
      data: [{ id: 'x', full_name: 'a/b' }],
    });
    expect(r.success).toBe(true);
  });

  it('accepts reviews list payload with pagination', () => {
    const r = reviewsListEnvelopeSchema.safeParse({
      data: [],
      pagination: { page: 1, limit: 10, total: 0 },
    });
    expect(r.success).toBe(true);
  });
});
