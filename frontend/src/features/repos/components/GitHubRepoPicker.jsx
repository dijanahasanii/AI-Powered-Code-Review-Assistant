import { Search, RefreshCw, CheckCircle2, Lock, Globe } from 'lucide-react';
import { Spinner } from '../../../components/common/UI';
import { describeApiFailure } from '../../../lib/apiErrors';
import { GitHubRepoPickerRowSkeleton } from '../../../components/common/Skeletons';

export function GitHubRepoPicker({
  search,
  onSearchChange,
  loadingGithub,
  githubError,
  onRefetchGithub,
  filteredRepos,
  connectedIds,
  connectingId,
  connectMutationPending,
  onConnectRepo,
}) {
  const githubFailure = githubError
    ? describeApiFailure(githubError, { resourceLabel: 'GitHub repository list' })
    : null;

  return (
    <div className="card mb-8 overflow-hidden">
      <div className="border-b border-desk-border px-4 py-4 sm:px-5">
        <h2 className="mb-3 text-[13px] font-semibold text-gray-900 dark:text-gray-100">
          Pick a repo from GitHub
        </h2>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-desk-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search repositories…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search GitHub repositories"
            className="w-full rounded-md border border-desk-border bg-desk-canvas py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-desk-muted focus:border-brand-600/60 focus:outline-none focus:ring-1 focus:ring-brand-600/40 dark:text-gray-200"
          />
        </div>
      </div>

      {loadingGithub ? (
        <div className="divide-y divide-desk-border" role="status" aria-label="Loading repositories">
          {Array.from({ length: 6 }).map((_, i) => (
            <GitHubRepoPickerRowSkeleton key={i} />
          ))}
        </div>
      ) : githubError ? (
        <div
          className="flex flex-col items-center gap-3 px-4 py-10 text-center"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm font-medium text-red-800 dark:text-red-200">{githubFailure.title}</p>
          <p className="max-w-md text-xs text-red-700/95 dark:text-red-300/90">{githubFailure.detail}</p>
          <button
            type="button"
            onClick={() => onRefetchGithub()}
            className="btn-secondary inline-flex gap-2 px-3 py-1.5 text-xs"
          >
            <RefreshCw size={12} aria-hidden="true" />
            Retry GitHub lookup
          </button>
        </div>
      ) : (
        <div className="max-h-80 divide-y divide-desk-border overflow-y-auto" role="list">
          {filteredRepos.length === 0 ? (
            <div className="px-4 py-10 text-center sm:px-5">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {search ? 'No repositories match your search' : 'No repositories from GitHub yet'}
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-desk-muted">
                {search
                  ? 'Try a shorter query, clear the search box, or confirm the repo name on GitHub.'
                  : 'This list uses your linked GitHub OAuth token. If you expected org repos, ensure you granted access and still have read rights — then use Retry above.'}
              </p>
            </div>
          ) : (
            filteredRepos.map((repo) => {
              const alreadyLinked = connectedIds.has(repo.githubRepoId);
              const busy = connectingId === repo.githubRepoId;

              return (
                <div
                  key={repo.githubRepoId}
                  role="listitem"
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-desk-elevated/50 sm:px-5"
                >
                  {repo.isPrivate ? (
                    <Lock size={13} className="shrink-0 text-desk-muted" aria-label="Private" />
                  ) : (
                    <Globe size={13} className="shrink-0 text-desk-muted" aria-label="Public" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{repo.fullName}</p>
                    {repo.language && <p className="text-xs text-desk-muted">{repo.language}</p>}
                  </div>
                  {alreadyLinked ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-400/95">
                      <CheckCircle2 size={12} aria-hidden="true" /> Connected
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary inline-flex min-w-[88px] shrink-0 justify-center px-3 py-1 text-xs"
                      onClick={() => onConnectRepo(repo)}
                      disabled={busy || connectMutationPending}
                      aria-label={`Connect ${repo.fullName}`}
                    >
                      {busy ? <Spinner size="sm" /> : 'Connect'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
