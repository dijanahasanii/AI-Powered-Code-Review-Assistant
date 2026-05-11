import {
  reposListEnvelopeSchema,
  reviewDetailEnvelopeSchema,
  reviewsListEnvelopeSchema,
  statsEnvelopeSchema,
} from './schemas';

function warnContract(label, result, url) {
  if (result.success) return;
  const detail = import.meta.env.DEV ? result.error.flatten() : undefined;
  console.warn(`[api-contract] ${label} response shape drift (non-fatal)`, url ?? '', detail ?? '');
}

/**
 * Attach to axios instance — must never throw or modify response body.
 * @param {import('axios').AxiosInstance} api
 */
export function attachApiContractGuard(api) {
  api.interceptors.response.use((response) => {
    try {
      const url = response.config?.url || '';
      const method = (response.config?.method || 'get').toLowerCase();
      if (method !== 'get' || typeof response.data !== 'object' || response.data === null) {
        return response;
      }

      if (url.includes('/api/reviews/stats')) {
        warnContract('GET /reviews/stats', statsEnvelopeSchema.safeParse(response.data), url);
        return response;
      }

      if (/\/api\/reviews\/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}(\?|$)/i.test(url)) {
        warnContract('GET /reviews/:id', reviewDetailEnvelopeSchema.safeParse(response.data), url);
        return response;
      }

      if (url.includes('/api/reviews')) {
        warnContract('GET /reviews', reviewsListEnvelopeSchema.safeParse(response.data), url);
        return response;
      }

      if (
        url.includes('/api/repos') &&
        !url.includes('/github') &&
        !url.includes('sync-webhook')
      ) {
        warnContract('GET /repos', reposListEnvelopeSchema.safeParse(response.data), url);
        return response;
      }
    } catch {
      /* never break responses */
    }
    return response;
  });
}
