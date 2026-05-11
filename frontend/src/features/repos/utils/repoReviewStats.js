/**
 * Completed reviews for a repository, newest first (for latest score UI).
 */
export function getCompletedReviewsNewestFirst(repo) {
  return (repo.code_reviews ?? [])
    .filter((r) => r.status === 'completed')
    .sort((a, b) => {
      const tb = new Date(b.created_at ?? 0).getTime();
      const ta = new Date(a.created_at ?? 0).getTime();
      return tb - ta;
    });
}

/**
 * Derived health strip for repo cards (webhook + latest score heuristic).
 */
export function repoHealthStatus(repo) {
  const completedReviews = getCompletedReviewsNewestFirst(repo);
  const latestScore = completedReviews[0]?.overall_score;

  if (!repo.webhook_active) {
    return {
      key: 'webhook',
      label: 'Webhook off',
      detail: 'Push automation unavailable',
      className:
        'border-amber-600/30 bg-amber-500/[0.12] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100',
      dot: 'bg-amber-500 dark:bg-amber-400',
    };
  }
  if (latestScore != null && latestScore < 70) {
    return {
      key: 'findings',
      label: 'Findings',
      detail: `Latest score ${latestScore}/100`,
      className:
        'border-orange-600/30 bg-orange-500/[0.12] text-orange-950 dark:border-orange-500/35 dark:bg-orange-500/10 dark:text-orange-100',
      dot: 'bg-orange-600 dark:bg-orange-400',
    };
  }
  if (latestScore != null && latestScore >= 90) {
    return {
      key: 'healthy',
      label: 'Healthy',
      detail: 'Recent scan looks strong',
      className:
        'border-emerald-600/30 bg-emerald-500/[0.14] text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100',
      dot: 'bg-emerald-600 dark:bg-emerald-400',
    };
  }
  return {
    key: 'synced',
    label: 'Synced',
    detail: 'Webhook active — monitoring pushes',
    className: 'border-desk-border bg-desk-elevated/60 text-gray-800 dark:text-gray-200',
    dot: 'bg-[#58a6ff]',
  };
}
