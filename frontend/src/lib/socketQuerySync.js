import { queryKeys } from './queryKeys';

const INVALIDATE_DEBOUNCE_MS = 400;
let invalidateTimer = null;

function patchReviewsInBundle(queryClient, reviewId, patch) {
  queryClient.setQueriesData({ queryKey: queryKeys.dashboardBundle }, (old) => {
    if (!old?.recentReviews) return old;
    const idx = old.recentReviews.findIndex((row) => row.id === reviewId);
    if (idx === -1) return old;
    const recentReviews = old.recentReviews.map((row) =>
      row.id === reviewId ? { ...row, ...patch } : row
    );
    return { ...old, recentReviews };
  });

  queryClient.setQueriesData({ queryKey: queryKeys.reviewsAll }, (old) => {
    if (!old?.data || !Array.isArray(old.data)) return old;
    const data = old.data.map((row) => (row.id === reviewId ? { ...row, ...patch } : row));
    return { ...old, data };
  });
}

function refetchDashboard(queryClient) {
  return queryClient.refetchQueries({ queryKey: queryKeys.dashboardBundle, type: 'active' });
}

/**
 * Debounced refetch for repos + stats after bursts of socket events.
 */
export function scheduleDebouncedDashboardRefresh(queryClient, { includeReports = false } = {}) {
  if (invalidateTimer) clearTimeout(invalidateTimer);
  invalidateTimer = setTimeout(() => {
    invalidateTimer = null;
    void refetchDashboard(queryClient);
    queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    queryClient.invalidateQueries({ queryKey: queryKeys.repos });
    if (includeReports) {
      queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll, refetchType: 'all' });
    }
  }, INVALIDATE_DEBOUNCE_MS);
}

/**
 * Patch cached lists when Socket.IO emits review:update (instant status/score on known rows).
 */
export function applyReviewUpdateToCaches(queryClient, update) {
  const reviewId = update?.reviewId;
  const status = update?.status;
  if (!reviewId || !status) return;

  const patch = {
    status,
    ...(update.overallScore != null ? { overall_score: update.overallScore } : {}),
  };

  patchReviewsInBundle(queryClient, reviewId, patch);

  if (status === 'processing' || status === 'pending') {
    void refetchDashboard(queryClient);
    scheduleDebouncedDashboardRefresh(queryClient, { includeReports: false });
    return;
  }

  if (status === 'completed') {
    queryClient.invalidateQueries({
      queryKey: queryKeys.reportsAll,
      refetchType: 'all',
    });
    void queryClient.refetchQueries({ queryKey: queryKeys.dashboardBundle, type: 'all' });
    queryClient.invalidateQueries({ queryKey: queryKeys.reviewsAll, refetchType: 'all' });
  }

  if (status === 'completed' || status === 'failed') {
    scheduleDebouncedDashboardRefresh(queryClient, {
      includeReports: status === 'completed',
    });
  }
}
