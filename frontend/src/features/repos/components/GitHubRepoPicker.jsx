import { Search, RefreshCw, CheckCircle2, Lock, Globe } from 'lucide-react';
import { Spinner } from '../../../components/common/UI';

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
        <div className="flex items-center justify-center gap-3 py-10 text-sm text-desk-muted">
          <Spinner size="sm" />
          Loading repositories…
        </div>
      ) : githubError ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm text-red-400">Unable to fetch GitHub repositories.</p>
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
            <p className="px-4 py-10 text-center text-sm text-desk-muted">
              {search ? 'No repos match your search.' : 'No repositories returned for this OAuth token.'}
            </p>
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
