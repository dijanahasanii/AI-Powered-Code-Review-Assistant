import { z } from 'zod';

/**
 * Loose runtime checks for API drift — failures only log a warning; responses are never stripped.
 */
const paginationSchema = z
  .object({
    page: z.coerce.number(),
    limit: z.coerce.number(),
    total: z.union([z.number(), z.null()]).optional(),
  })
  .passthrough();

export const reviewsListEnvelopeSchema = z
  .object({
    success: z.boolean().optional(),
    data: z.array(z.unknown()),
    pagination: paginationSchema.optional(),
  })
  .passthrough();

export const reposListEnvelopeSchema = z
  .object({
    success: z.boolean().optional(),
    data: z.array(z.unknown()),
  })
  .passthrough();

export const reviewDetailEnvelopeSchema = z
  .object({
    success: z.boolean().optional(),
    data: z.unknown(),
  })
  .passthrough();

export const statsEnvelopeSchema = z
  .object({
    success: z.boolean().optional(),
    data: z
      .object({
        total: z.number().optional(),
        completed: z.number().optional(),
        pending: z.number().optional(),
        processing: z.number().optional(),
        avgScore: z.union([z.number(), z.null()]).optional(),
        issues: z.record(z.number()).optional(),
      })
      .passthrough(),
  })
  .passthrough();
