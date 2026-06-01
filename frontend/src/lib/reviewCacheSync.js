import { queryKeys } from './queryKeys';

function belongsToRepository(review, repositoryId) {
  if (!review || !repositoryId) return false;
  return review.repository_id === repositoryId || review.repositories?.id === repositoryId;
}

/**
 * Drop reviews for a disconnected repository from all list caches (instant UI).
 */
export function purgeReviewsForRepository(queryClient, repositoryId) {
  if (!repositoryId) return;

  queryClient.setQueriesData({ queryKey: queryKeys.reviewsAll }, (old) => {
    if (!old?.data || !Array.isArray(old.data)) return old;
    const data = old.data.filter((r) => !belongsToRepository(r, repositoryId));
    const removed = old.data.length - data.length;
    if (removed === 0) return old;
    return {
      ...old,
      data,
      pagination: old.pagination
        ? {
            ...old.pagination,
            total: Math.max(0, (Number(old.pagination.total) || 0) - removed),
          }
        : old.pagination,
    };
  });

  queryClient.setQueriesData({ queryKey: queryKeys.dashboardBundle }, (old) => {
    if (!old?.recentReviews) return old;
    const recentReviews = old.recentReviews.filter((r) => !belongsToRepository(r, repositoryId));
    if (recentReviews.length === old.recentReviews.length) return old;
    return { ...old, recentReviews };
  });
}

/**
 * After disconnect/delete — refetch lists so server and UI stay aligned.
 */
export function refreshWorkspaceAfterRepositoryRemoved(queryClient) {
  return Promise.all([
    queryClient.refetchQueries({ queryKey: queryKeys.dashboardBundle, type: 'all' }),
    queryClient.refetchQueries({ queryKey: queryKeys.reviewsAll, type: 'all' }),
    queryClient.refetchQueries({ queryKey: queryKeys.reportsAll, type: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.stats }),
    queryClient.invalidateQueries({ queryKey: ['review'] }),
  ]);
}
