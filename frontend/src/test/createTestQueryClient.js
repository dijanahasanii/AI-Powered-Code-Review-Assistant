import { QueryClient } from '@tanstack/react-query';

/** Disables retries and keeps cache ephemeral for deterministic UI tests. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}
