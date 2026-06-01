const ACTIVE_LIFECYCLE = new Set(['open', 'reopened']);

/** @param {{ lifecycle_status?: string|null }} issue */
export function isActiveReviewIssue(issue) {
  const status = issue?.lifecycle_status;
  return !status || ACTIVE_LIFECYCLE.has(status);
}

/** @param {object[]} issues */
export function filterActiveReviewIssues(issues) {
  return (issues || []).filter(isActiveReviewIssue);
}
