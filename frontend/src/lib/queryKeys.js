/**
 * TanStack Query key factory — keeps invalidation + reads aligned.
 */
export const queryKeys = {
  stats: ['stats'],
  repos: ['repos'],
  reposGithub: ['repos-github'],
  /** Prefix; invalidates all review list queries (TanStack Query partial match). */
  reviewsAll: ['reviews'],
  reviewsList: (params) => ['reviews', params],
  reviewDetail: (id) => ['review', id],
  reportsAll: ['reports'],
  reportsList: (params) => ['reports', params],
  reportDetail: (id) => ['report', id],
  reportMarkdown: (id) => ['report-markdown', id],
};
